"""Everything that speaks the Telegram Bot API, and nothing that knows our tables.

The same three jobs `core/whatsapp.py` does — proving an update is genuine,
turning its payload into plain values, and handing a message back the other way
— and the same rule: nothing here imports a model or a session.
`TelegramService` is what joins this to the database.

**Three things differ from WhatsApp and every one of them is protocol, not
taste.**

*An update names no bot.* Meta writes `phone_number_id` into the body, so the
inbox a delivery belongs to can be read out of what arrived. Telegram sends the
same shape to whatever URL you registered and says nothing about which bot it
is — so the secret is the routing key as well as the proof: `setWebhook` takes
a `secret_token`, Telegram returns it in `X-Telegram-Bot-Api-Secret-Token` on
every update, and one shared path still resolves to one bot. **Finding the row
that carries it is the whole of the check** — there is no HMAC to verify and
no second comparison to make, which is why nothing in this module compares
secrets: `TelegramAccountRepository.get_by_webhook_secret` is where that
happens, as an indexed lookup on a 256-bit value.

*There is no delivery report.* A bot learns whether the API accepted the send
and nothing after that: no `delivered`, no `read`. So a Telegram message stops
at `sent`, and `apply_receipt` has no counterpart here. Faking the other two
would be the app inventing a fact about somebody else's phone.

*There is no 24-hour window.* A bot may write whenever it likes — to somebody
who has pressed Start. Before that there is no chat at all, which is a
different refusal and worded as one below.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# What Telegram echoes back from `setWebhook(secret_token=…)`. Our only proof
# that an update is genuine, and the value the inbox is resolved by.
# `noqa`: this is the *name* of a header, not a secret. Ruff flags the
# word; the value it carries is generated per bot and lives in
# `telegram_accounts.webhook_secret`, never here.
SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token"  # noqa: S105

# The same reasoning as WhatsApp's table: a client who sends a photo and then
# «вот так» has said two things, and dropping the first leaves the second
# answering nothing. Keyed by the field Telegram puts on the message.
MEDIA_PLACEHOLDERS = {
    "photo": "[фото]",
    "video": "[видео]",
    "video_note": "[видеосообщение]",
    "animation": "[GIF]",
    "audio": "[аудио]",
    "voice": "[голосовое сообщение]",
    "document": "[документ]",
    "sticker": "[стикер]",
    "location": "[геолокация]",
    "venue": "[место]",
    "contact": "[контакт]",
    "poll": "[опрос]",
    "dice": "[игра]",
}
UNKNOWN_PLACEHOLDER = "[вложение]"

# Ours rather than Telegram's: nothing is connected, so there was nowhere to
# send it. Beside the refusals below because every sentence that can end up in
# `messages.error` is one family — the thread draws them all the same way.
NOT_CONNECTED = "Telegram-бот не подключён — сообщение сохранено, но не отправлено."


class TelegramSendError(Exception):
    """A send Telegram refused, carrying words the owner can act on.

    `reason` is what goes on screen and into `messages.error`; `code` is the
    HTTP status Telegram answered with, kept for the log.
    """

    def __init__(self, reason: str, code: int | None = None) -> None:
        super().__init__(reason)
        self.reason = reason
        self.code = code


class TelegramAuthError(Exception):
    """The token itself is wrong — a different thing from a refused send.

    Raised only while connecting, where it means the owner mistyped or revoked
    the token; the card can say so instead of storing a credential that will
    fail silently on the first reply.
    """


# Telegram answers a refusal with a sentence in `description`, and its
# sentences are English and specific. Only the ones worth wording again are
# here: they are the ones that will actually happen, and they say what to do
# rather than what went wrong.
_ERROR_MESSAGES: dict[str, str] = {
    "bot was blocked by the user": (
        "Клиент заблокировал бота — сообщение не доставлено."
    ),
    "chat not found": (
        "Клиент ещё не открывал этот чат — бот не может написать первым. "
        "Попросите его нажать «Старт» в боте."
    ),
    "user is deactivated": "Аккаунт клиента удалён — сообщение не доставлено.",
    "message text is empty": "Пустое сообщение отправить нельзя.",
    "message is too long": "Сообщение слишком длинное для Telegram.",
}


@dataclass(slots=True)
class BotIdentity:
    """Who a token belongs to, as Telegram reports it."""

    bot_id: int
    username: str | None


@dataclass(slots=True)
class InboundMessage:
    """One message a client sent, in our words rather than Telegram's."""

    chat_id: str
    message_id: str
    body: str
    first_name: str | None = None
    last_name: str | None = None
    username: str | None = None
    phone: str | None = None
    # **The file Telegram holds, not the file itself.** An update carries an id
    # and nothing else; the bytes are a second call with the bot's token on it,
    # which is the channel's business rather than the parser's. `None` for
    # every message that is words.
    photo_id: str | None = None
    sent_at: datetime | None = None

    @property
    def client_name(self) -> str | None:
        """First and last as one line, or nothing.

        A Telegram account always has a first name and often nothing else, so
        this is usually one word — which is still more than the number
        WhatsApp gives, and it is what the thread shows.
        """
        parts = [part for part in (self.first_name, self.last_name) if part]
        return " ".join(parts)[:120] or None


def parse(payload: dict[str, Any]) -> InboundMessage | None:
    """One update, or `None` for everything this app has no use for.

    **Never raises.** Telegram redelivers what it did not get a 200 for, and an
    update it cannot stop sending is worse than one we ignore: a bot receives
    edits, channel posts, join requests, poll answers and callback presses on
    the same subscription, and none of those is a message in a thread.

    Edits are deliberately skipped rather than applied. Telegram sends the new
    text as `edited_message` with the *original* `message_id`, so applying it
    would rewrite a line the owner has already read and answered — a transcript
    that changes behind you is worse than one that is a few words out of date.
    """
    message = payload.get("message")
    if not isinstance(message, dict):
        return None

    chat = message.get("chat")
    if not isinstance(chat, dict) or chat.get("type") != "private":
        # Groups and channels are a different product: a thread here is one
        # client, and the assistant answering into a group chat is not
        # something anything downstream is built for.
        return None

    chat_id = chat.get("id")
    message_id = message.get("message_id")
    if chat_id is None or message_id is None:
        return None

    body = _body(message)
    if body is None:
        return None

    sender = message.get("from") if isinstance(message.get("from"), dict) else {}
    contact = message.get("contact") if isinstance(message.get("contact"), dict) else {}

    return InboundMessage(
        chat_id=str(chat_id)[:64],
        message_id=str(message_id)[:64],
        body=body,
        first_name=_text(sender.get("first_name"), 64),
        last_name=_text(sender.get("last_name"), 64),
        username=_text(sender.get("username"), 64),
        # **Only when the client shared their own card.** Telegram sends a
        # contact for any card forwarded into the chat, so a number belonging
        # to somebody else must not become this client's number: the two ids
        # have to match.
        phone=(
            _text(contact.get("phone_number"), 32)
            if contact.get("user_id") == sender.get("id")
            else None
        ),
        photo_id=_photo_id(message),
        sent_at=_timestamp(message.get("date")),
    )


def _body(message: dict[str, Any]) -> str | None:
    """What to write in the thread for this message.

    Text and a caption are the message itself. Everything else is a placeholder
    naming what arrived, plus the caption if there was one — see
    `MEDIA_PLACEHOLDERS`. A message with none of that (somebody joined, a pin
    was changed) is not a message and returns `None`.
    """
    text = _text(message.get("text"), 4096)
    if text:
        return text

    for field_name, placeholder in MEDIA_PLACEHOLDERS.items():
        if message.get(field_name) is None:
            continue
        caption = _text(message.get("caption"), 4096)
        return f"{placeholder} {caption}" if caption else placeholder

    # A card the client chose from a keyboard is the text they meant to send.
    caption = _text(message.get("caption"), 4096)
    if caption:
        return f"{UNKNOWN_PLACEHOLDER} {caption}"
    return None


def _photo_id(message: dict[str, Any]) -> str | None:
    """The largest size of a photo, if the message is one.

    **Telegram sends a photo as a list of sizes**, smallest first, all of one
    picture — a thumbnail for a preview, then progressively larger files. The
    last is the biggest, and it is the one to keep: what is stored is fitted to
    `chat_photo_max_px` anyway, and starting from a thumbnail would mean storing
    a blurred copy of a picture that was sent sharp.

    Only `photo`. A document may be an image too, but it may equally be a PDF
    or an archive, and a store that unpacked anything called a document would
    be downloading whatever a stranger decided to send.
    """
    sizes = message.get("photo")
    if not isinstance(sizes, list) or not sizes:
        return None
    largest = sizes[-1]
    if not isinstance(largest, dict):
        return None
    return _text(largest.get("file_id"), 256)


def _text(value: Any, limit: int) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()[:limit]
    return stripped or None


def _timestamp(value: Any) -> datetime | None:
    """Telegram's `date`, which is whole seconds since the epoch, in UTC.

    `None` rather than "now" when it is unreadable: the caller already falls
    back to its own clock, and a made-up instant here would be indistinguishable
    from a real one.
    """
    try:
        return datetime.fromtimestamp(int(value), tz=UTC)
    except (TypeError, ValueError, OSError):
        return None


# --- the other way ------------------------------------------------------


def _api_url(token: str, method: str) -> str:
    return f"{settings.telegram_api_base.rstrip('/')}/bot{token}/{method}"


async def get_me(token: str) -> BotIdentity:
    """Who this token belongs to. **The only way to know it is a real token.**

    Called while connecting rather than trusting what was pasted: a token that
    is wrong fails here, where the owner is looking at the field, instead of on
    the first reply hours later.
    """
    try:
        async with httpx.AsyncClient(
            timeout=settings.telegram_timeout_seconds
        ) as client:
            response = await client.get(_api_url(token, "getMe"))
    except httpx.HTTPError as exc:
        logger.warning("Telegram getMe could not reach the API: %s", exc)
        raise TelegramSendError(
            "Не удалось связаться с Telegram. Попробуйте ещё раз."
        ) from exc

    parsed = _parsed(response)
    result = parsed.get("result") if isinstance(parsed.get("result"), dict) else None
    if response.status_code >= 400 or not result:
        logger.warning(
            "Telegram refused getMe: HTTP %s, %s",
            response.status_code,
            parsed.get("description"),
        )
        raise TelegramAuthError(parsed.get("description") or "invalid token")

    bot_id = result.get("id")
    if not isinstance(bot_id, int):
        raise TelegramAuthError("getMe returned no bot id")
    return BotIdentity(bot_id=bot_id, username=_text(result.get("username"), 64))


async def get_updates(
    *, token: str, offset: int | None, wait_seconds: int
) -> list[dict[str, Any]]:
    """Ask Telegram what has arrived, and wait `wait_seconds` for it to.

    **The other direction of the same channel.** A webhook is Telegram calling
    us; this is us calling Telegram, which is the only one of the two a machine
    with no public address can use — see `services/telegram_poller.py` for when
    that is the right trade.

    `offset` is the acknowledgement: sending the last `update_id` plus one is
    what tells Telegram those are dealt with and must not be sent again. Until
    it is sent they are redelivered on every call, which is the behaviour to
    lean on when something fails — and the reason nothing here parses or stores
    anything itself.

    Long-polled, so an idle bot costs one held-open request every `timeout`
    seconds rather than a loop of empty answers. The HTTP timeout has to be the
    larger of the two or the client would hang up on a wait it asked for; the
    usual send timeout is added on top as the margin for the round trip.

    Raises `TelegramSendError` on anything that is not a plain answer — a
    dropped connection, or Telegram's own 409, which is what it says when this
    bot has a webhook registered or is already being polled somewhere else.
    """
    # `wait_seconds` and not `timeout`: this is how long Telegram is asked to
    # hold the answer back, which is the opposite of a deadline — the deadline
    # is the HTTP one below, and it has to be the larger of the two.
    payload: dict[str, Any] = {
        "timeout": wait_seconds,
        # Messages only, for the same reason `set_webhook` narrows it: this bot
        # has nothing to say about an edit, a poll answer or a chat member
        # joining, and an update nobody reads is a round trip nobody needs.
        "allowed_updates": ["message"],
    }
    if offset is not None:
        payload["offset"] = offset

    try:
        async with httpx.AsyncClient(
            timeout=wait_seconds + settings.telegram_timeout_seconds
        ) as client:
            response = await client.post(_api_url(token, "getUpdates"), json=payload)
    except httpx.HTTPError as exc:
        raise TelegramSendError(f"getUpdates could not reach Telegram: {exc}") from exc

    parsed = _parsed(response)
    if response.status_code >= 400 or not parsed.get("ok"):
        raise TelegramSendError(
            parsed.get("description")
            or f"getUpdates failed: HTTP {response.status_code}",
            code=response.status_code,
        )

    result = parsed.get("result")
    if not isinstance(result, list):
        return []
    return [item for item in result if isinstance(item, dict)]


async def download_file(*, token: str, file_id: str) -> bytes | None:
    """The bytes behind a `file_id`, or `None` if they cannot be had.

    **Two calls, and Telegram gives no way round it.** `getFile` turns the id
    into a path that is only valid for about an hour, and the bytes come from a
    different host to the API one. Both carry the bot token — a file is as
    private as the chat it was sent in.

    **`None` rather than an exception**, because of where this is called from:
    the message is being written into the inbox, and a photo that could not be
    fetched must not cost the owner the message it came with. The text still
    says «[фото]» and the caption is still there; what is missing is the
    picture, which is what the bubble then says.
    """
    try:
        async with httpx.AsyncClient(
            timeout=settings.telegram_timeout_seconds
        ) as client:
            answer = await client.get(
                _api_url(token, "getFile"), params={"file_id": file_id}
            )
            parsed = _parsed(answer)
            result = parsed.get("result")
            path = result.get("file_path") if isinstance(result, dict) else None
            if answer.status_code >= 400 or not isinstance(path, str):
                logger.warning(
                    "Telegram refused getFile: HTTP %s, %s",
                    answer.status_code,
                    parsed.get("description"),
                )
                return None

            base = settings.telegram_api_base.rstrip("/")
            file = await client.get(f"{base}/file/bot{token}/{path}")
            if file.status_code >= 400:
                logger.warning(
                    "Telegram file download failed: HTTP %s", file.status_code
                )
                return None
            return file.content
    except httpx.HTTPError as exc:
        logger.warning("Telegram file could not be fetched: %s", exc)
        return None


async def set_webhook(*, token: str, url: str, secret: str) -> None:
    """Point Telegram at us, and hand it the secret every update must carry back.

    `drop_pending_updates` is on: a bot reconnected after a week should not
    open with a backlog of messages whose moment has passed, and the client who
    still wants an answer writes again.

    `allowed_updates` is narrowed to messages for the same reason `parse`
    ignores the rest — asking for less is one fewer thing arriving that nothing
    reads.
    """
    try:
        async with httpx.AsyncClient(
            timeout=settings.telegram_timeout_seconds
        ) as client:
            response = await client.post(
                _api_url(token, "setWebhook"),
                json={
                    "url": url,
                    "secret_token": secret,
                    "allowed_updates": ["message"],
                    "drop_pending_updates": True,
                },
            )
    except httpx.HTTPError as exc:
        logger.warning("Telegram setWebhook could not reach the API: %s", exc)
        raise TelegramSendError(
            "Не удалось связаться с Telegram. Попробуйте ещё раз."
        ) from exc

    if response.status_code >= 400:
        raise _refusal(response)


async def delete_webhook(token: str) -> None:
    """Stop Telegram sending here. **Failure is not worth reporting.**

    Disconnecting has already removed the row, so an update that still arrives
    resolves to no account and is dropped. Telling the owner their disconnect
    failed, when from their side it plainly did not, would be the app worrying
    out loud about its own housekeeping.
    """
    try:
        async with httpx.AsyncClient(
            timeout=settings.telegram_timeout_seconds
        ) as client:
            await client.post(_api_url(token, "deleteWebhook"))
    except httpx.HTTPError as exc:
        logger.info("Telegram deleteWebhook failed, ignored: %s", exc)


async def send_text(*, token: str, chat_id: str, body: str) -> str:
    """Send one message. Returns Telegram's `message_id` for it.

    Raises `TelegramSendError` on anything that is not a success, including a
    network failure — the caller has a row on screen to mark, so "it did not
    go" has to be one kind of answer rather than two.
    """
    try:
        async with httpx.AsyncClient(
            timeout=settings.telegram_timeout_seconds
        ) as client:
            response = await client.post(
                _api_url(token, "sendMessage"),
                json={
                    "chat_id": chat_id,
                    "text": body,
                    # Off deliberately, the same call WhatsApp's `preview_url`
                    # makes: a preview is Telegram fetching the page and pinning
                    # a card to the message, which changes what the owner sees
                    # sent from what they typed.
                    "link_preview_options": {"is_disabled": True},
                },
            )
    except httpx.HTTPError as exc:
        logger.warning("Telegram send could not reach the API: %s", exc)
        raise TelegramSendError(
            "Не удалось связаться с Telegram. Попробуйте ещё раз."
        ) from exc

    if response.status_code >= 400:
        raise _refusal(response)

    return _sent_id(response)


def _parsed(response: httpx.Response) -> dict[str, Any]:
    try:
        parsed = response.json()
    except ValueError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _refusal(response: httpx.Response) -> TelegramSendError:
    parsed = _parsed(response)
    description = parsed.get("description")
    description = description if isinstance(description, str) else ""

    logger.warning(
        "Telegram refused a call: HTTP %s, %s", response.status_code, description
    )

    lowered = description.lower()
    for fragment, message in _ERROR_MESSAGES.items():
        if fragment in lowered:
            return TelegramSendError(message, response.status_code)

    return TelegramSendError(
        description or "Telegram отклонил сообщение.", response.status_code
    )


def _sent_id(response: httpx.Response) -> str:
    """The `message_id` out of a success.

    A 200 whose shape we cannot read is still a message that went — refusing it
    here would mark a delivered message failed, which is the worse of the two
    mistakes.
    """
    result = _parsed(response).get("result")
    if isinstance(result, dict) and result.get("message_id") is not None:
        return str(result["message_id"])[:64]
    return ""
