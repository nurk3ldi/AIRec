"""The assistant's language model, behind one function.

**Nothing here knows our tables**, the same rule `core/telegram.py` keeps: it
takes a system instruction and a transcript of plain values and gives back text.
`AssistantService` is what turns a conversation and a business into those.

**The provider is a setting, not an import.** `generate_reply` dispatches on
`settings.llm_provider`, and each provider is one private function that speaks
its own HTTP API over the `httpx` already pinned for the channels — no SDK, so
switching Gemini for GPT or Claude later is a new function here and a key in
`.env`, and nothing above this file changes.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Literal

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

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


class LLMNotConfigured(Exception):
    """No key for the chosen provider — the assistant stays silent."""


class LLMError(Exception):
    """The model could not produce a reply: refused, blocked, or unreachable."""


async def generate_reply(system: str, turns: list[Turn]) -> str:
    """The next thing the business says, or an exception saying why not."""
    provider = settings.llm_provider.lower()
    if provider == "gemini":
        return await _gemini(system, turns)
    raise LLMNotConfigured(f"Unknown LLM_PROVIDER {settings.llm_provider!r}")


# --- Gemini ------------------------------------------------------------------


async def _gemini(system: str, turns: list[Turn]) -> str:
    """`models.generateContent` over REST.

    **The key travels in `x-goog-api-key`, not in `?key=`**, which the docs
    also accept: a query string ends up in access logs and proxy traces, a
    header does not.

    **Consecutive turns from one side are merged**, and a transcript that
    starts with ours is trimmed to the first client turn. Gemini reads
    `contents` as a dialogue that opens with the user, and two assistant
    messages in a row (a reply, then the owner) are one side speaking twice —
    joined, they say the same thing in the shape the API expects.
    """
    if settings.gemini_api_key is None:
        raise LLMNotConfigured("GEMINI_API_KEY is not set")

    contents: list[dict[str, Any]] = []
    for turn in turns:
        role = "user" if turn.speaker == "client" else "model"
        if not contents and role == "model":
            continue
        if contents and contents[-1]["role"] == role:
            contents[-1]["parts"][0]["text"] += f"\n\n{turn.text}"
        else:
            contents.append({"role": role, "parts": [{"text": turn.text}]})

    if not contents:
        raise LLMError("Nothing from the client to answer")

    base = settings.gemini_api_base.rstrip("/")
    url = f"{base}/models/{settings.gemini_model}:generateContent"
    body = {
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

    candidate = candidates[0]
    parts = (candidate.get("content") or {}).get("parts") or []
    # A thinking model may return its reasoning as parts marked `thought`;
    # only the answer goes to the client.
    text = "".join(
        part.get("text", "") for part in parts if not part.get("thought")
    ).strip()
    if not text:
        reason = candidate.get("finishReason")
        raise LLMError(f"Gemini gave no text (finishReason={reason})")

    return text[:MAX_REPLY_CHARS]
