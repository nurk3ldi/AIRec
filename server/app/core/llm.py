"""The assistant's language model, behind one function.

**Nothing here knows our tables**, the same rule `core/telegram.py` keeps: it
takes a system instruction and a transcript of plain values and gives back text.
`AssistantService` is what turns a conversation and a business into those.

**The provider is a setting, not an import.** `generate_reply` dispatches on
`settings.llm_provider`, and each provider is one private function that speaks
its own HTTP API over the `httpx` already pinned for the channels — no SDK, so
adding a provider is a new function here and a key in `.env`, and nothing
above this file changes. Two exist: Gemini (raw REST) and Claude (the official
`anthropic` SDK).
"""

from __future__ import annotations

import json
import logging
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from typing import Any, Literal

import anthropic
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# How many times one reply may call a tool before it has to answer in words. One
# call is the ordinary case; the ceiling only stops a model that loops.
MAX_TOOL_ROUNDS = 3

# Telegram refuses a message over 4096 characters. A receptionist never needs
# that much, and a model that produced it has gone wrong somewhere — cut rather
# than fail the send.
MAX_REPLY_CHARS = 4000


@dataclass(frozen=True, slots=True)
class Turn:
    """One message of the transcript, as the model is shown it.

    `client` is the person writing to the business; `business` is everything
    said from our side — the assistant's replies and the owner's, the latter
    already prefixed by the caller so the model can tell who stepped in.
    """

    speaker: Literal["client", "business"]
    text: str


@dataclass(frozen=True, slots=True)
class Tool:
    """Something the model may do rather than say.

    `parameters` is a JSON Schema object (the OpenAPI subset every provider
    accepts). `run` takes the arguments the model chose and returns a plain
    dict the model is shown as the result — errors included, as data, so the
    model can explain them to the client instead of the reply failing.
    """

    name: str
    description: str
    parameters: dict[str, Any]
    run: Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]


class LLMNotConfigured(Exception):
    """No key for the chosen provider — the assistant stays silent."""


class LLMError(Exception):
    """The model could not produce a reply: refused, blocked, or unreachable."""


def configured() -> tuple[str, str | None, bool]:
    """(provider, model, whether a key is set) — what the dashboard reports.

    **Configured, not proven.** A set key may still be wrong or out of quota;
    finding that out means a paid request, and the log already says so the
    first time a reply fails.
    """
    provider = settings.llm_provider.lower()
    if provider == "gemini":
        return provider, settings.gemini_model, settings.gemini_api_key is not None
    if provider == "claude":
        return provider, settings.llm_claude_model, settings.anthropic_api_key is not None
    return provider, None, False


async def generate_reply(
    system: str, turns: list[Turn], tools: Sequence[Tool] = ()
) -> str:
    """The next thing the business says, or an exception saying why not.

    With `tools`, the model may call them first; each call is run and its
    result handed back, and what comes out at the end is still text.
    """
    provider = settings.llm_provider.lower()
    if provider == "gemini":
        return await _gemini(system, turns, tools)
    if provider == "claude":
        return await _claude(system, turns, tools)
    raise LLMNotConfigured(f"Unknown LLM_PROVIDER {settings.llm_provider!r}")


# --- Claude ------------------------------------------------------------------

# Opt-in to server-side refusal fallbacks: if the model declines a turn, the
# API re-runs it on a fallback model inside the same call, so a client never
# gets silence because of a classifier false positive.
_CLAUDE_BETAS = ["server-side-fallback-2026-07-01"]


async def _claude(system: str, turns: list[Turn], tools: Sequence[Tool]) -> str:
    """The Messages API through the official `anthropic` SDK.

    **The transcript is shaped like Gemini's**: consecutive turns from one side
    are merged and a transcript that opens with ours is trimmed to the first
    client turn — the API wants a dialogue that starts with the user.

    **A tool call is answered and the model asked again.** The assistant turn
    goes back as the SDK returned it (`response.content`, thinking blocks
    included — they must not be edited), followed by every `tool_result` in one
    user message.
    """
    if settings.anthropic_api_key is None:
        raise LLMNotConfigured("ANTHROPIC_API_KEY is not set")

    messages: list[dict[str, Any]] = []
    for turn in turns:
        role = "user" if turn.speaker == "client" else "assistant"
        if not messages and role == "assistant":
            continue
        if messages and messages[-1]["role"] == role:
            messages[-1]["content"] += "\n\n" + turn.text
        else:
            messages.append({"role": role, "content": turn.text})

    if not messages:
        raise LLMError("Nothing from the client to answer")

    by_name = {tool.name: tool for tool in tools}
    tool_params = [
        {
            "name": tool.name,
            "description": tool.description,
            "input_schema": tool.parameters,
        }
        for tool in tools
    ]

    client = anthropic.AsyncAnthropic(
        api_key=settings.anthropic_api_key.get_secret_value(),
        timeout=settings.llm_timeout_seconds,
    )
    async with client:
        for _ in range(MAX_TOOL_ROUNDS + 1):
            response = await _claude_call(client, system, messages, tool_params)

            if response.stop_reason == "refusal":
                raise LLMError("Claude declined to answer")

            calls = [block for block in response.content if block.type == "tool_use"]
            if not calls:
                text = "".join(
                    block.text for block in response.content if block.type == "text"
                ).strip()
                if not text:
                    raise LLMError(
                        f"Claude gave no text (stop_reason={response.stop_reason})"
                    )
                return text[:MAX_REPLY_CHARS]

            messages.append({"role": "assistant", "content": response.content})
            results = []
            for call in calls:
                tool = by_name.get(call.name)
                if tool is None:
                    result: dict[str, Any] = {
                        "ok": False,
                        "error": f"Unknown tool {call.name}",
                    }
                else:
                    result = await tool.run(dict(call.input or {}))
                results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": call.id,
                        "content": json.dumps(result, ensure_ascii=False),
                    }
                )
            messages.append({"role": "user", "content": results})

    raise LLMError("Claude kept calling tools without answering")


async def _claude_call(
    client: anthropic.AsyncAnthropic,
    system: str,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]],
) -> Any:
    """One request; the SDK's typed errors become `LLMError`, retryable first."""
    try:
        return await client.beta.messages.create(
            model=settings.llm_claude_model,
            max_tokens=4096,
            system=system,
            messages=messages,
            tools=tools,
            # A receptionist's reply is short and somebody is waiting for it:
            # little thinking, quick answer. Raise it in `.env` if replies need
            # more care.
            output_config={"effort": settings.llm_claude_effort},
            betas=_CLAUDE_BETAS,
            fallbacks="default",
        )
    except anthropic.RateLimitError as exc:
        raise LLMError(f"Claude rate limited: {exc}") from exc
    except anthropic.InternalServerError as exc:
        raise LLMError(f"Claude server error: {exc}") from exc
    except anthropic.APIStatusError as exc:
        raise LLMError(f"Claude {exc.status_code}: {exc.message}") from exc
    except anthropic.APIConnectionError as exc:
        raise LLMError(f"Claude unreachable: {exc}") from exc


# --- Gemini ------------------------------------------------------------------


async def _gemini(system: str, turns: list[Turn], tools: Sequence[Tool]) -> str:
    """`models.generateContent` over REST.

    **The key travels in `x-goog-api-key`, not in `?key=`**, which the docs
    also accept: a query string ends up in access logs and proxy traces, a
    header does not.

    **Consecutive turns from one side are merged**, and a transcript that
    starts with ours is trimmed to the first client turn. Gemini reads
    `contents` as a dialogue that opens with the user, and two assistant
    messages in a row (a reply, then the owner) are one side speaking twice —
    joined, they say the same thing in the shape the API expects.

    **A function call is answered and the model asked again.** The model's own
    parts go back *unchanged* — a thinking model signs them, and a call sent
    back without its signature is refused — followed by the result as a
    `functionResponse`.
    """
    if settings.gemini_api_key is None:
        raise LLMNotConfigured("GEMINI_API_KEY is not set")

    contents: list[dict[str, Any]] = []
    for turn in turns:
        role = "user" if turn.speaker == "client" else "model"
        if not contents and role == "model":
            continue
        if contents and contents[-1]["role"] == role:
            contents[-1]["parts"][0]["text"] += "\n\n" + turn.text
        else:
            contents.append({"role": role, "parts": [{"text": turn.text}]})

    if not contents:
        raise LLMError("Nothing from the client to answer")

    by_name = {tool.name: tool for tool in tools}
    for _ in range(MAX_TOOL_ROUNDS + 1):
        candidate = await _gemini_call(system, contents, tools)
        parts = (candidate.get("content") or {}).get("parts") or []
        calls = [part["functionCall"] for part in parts if part.get("functionCall")]

        if not calls:
            # A thinking model may return its reasoning as parts marked
            # `thought`; only the answer goes to the client.
            text = "".join(
                part.get("text", "") for part in parts if not part.get("thought")
            ).strip()
            if not text:
                reason = candidate.get("finishReason")
                raise LLMError(f"Gemini gave no text (finishReason={reason})")
            return text[:MAX_REPLY_CHARS]

        contents.append({"role": "model", "parts": parts})
        responses = []
        for call in calls:
            name = call.get("name", "")
            tool = by_name.get(name)
            if tool is None:
                result: dict[str, Any] = {"ok": False, "error": f"Unknown tool {name}"}
            else:
                result = await tool.run(call.get("args") or {})
            responses.append(
                {"functionResponse": {"name": name, "response": result}}
            )
        contents.append({"role": "user", "parts": responses})

    raise LLMError("Gemini kept calling tools without answering")


async def _gemini_call(
    system: str, contents: list[dict[str, Any]], tools: Sequence[Tool]
) -> dict[str, Any]:
    """One `generateContent` request; the first candidate, or `LLMError`."""
    base = settings.gemini_api_base.rstrip("/")
    url = f"{base}/models/{settings.gemini_model}:generateContent"
    body: dict[str, Any] = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": contents,
        "generationConfig": {
            # Low: a receptionist quoting a price should say the same price
            # twice. Some warmth is left so replies do not read as a form.
            "temperature": 0.4,
            # Generous, because on thinking models the budget covers the
            # thinking as well as the answer, and a cut-off answer is worse
            # than a slightly slower one.
            "maxOutputTokens": 2048,
        },
    }
    if tools:
        body["tools"] = [
            {
                "functionDeclarations": [
                    {
                        "name": tool.name,
                        "description": tool.description,
                        "parameters": tool.parameters,
                    }
                    for tool in tools
                ]
            }
        ]

    try:
        async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
            response = await client.post(
                url,
                headers={"x-goog-api-key": settings.gemini_api_key.get_secret_value()},
                json=body,
            )
    except httpx.HTTPError as exc:
        raise LLMError(f"Gemini unreachable: {exc}") from exc

    try:
        payload = response.json()
    except ValueError:
        payload = {}

    if response.status_code >= 400:
        error = payload.get("error") if isinstance(payload, dict) else None
        detail = (error or {}).get("message") or response.text[:200]
        raise LLMError(f"Gemini {response.status_code}: {detail}")

    blocked = (payload.get("promptFeedback") or {}).get("blockReason")
    if blocked:
        raise LLMError(f"Gemini blocked the prompt: {blocked}")

    candidates = payload.get("candidates") or []
    if not candidates:
        raise LLMError("Gemini returned no candidates")
    return candidates[0]
