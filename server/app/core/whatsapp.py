"""Everything that speaks WhatsApp Cloud API, and nothing that knows our tables.

Three jobs, deliberately in one module because they are three halves of one
protocol: proving a delivery really came from Meta, turning its payload into
plain values, and handing a message back the other way. Nothing here imports a
model or a session — `WhatsAppService` is what joins this to the database, and
keeping the seam here is what makes a second channel a second file rather than
a rewrite.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# What Meta signs its deliveries with. The `sha256=` prefix is part of the value.
SIGNATURE_HEADER = "X-Hub-Signature-256"

# Messages that are not text still have to appear in the thread — a client who
# sends a photo and then "вот так" has said two things, and dropping the first
# leaves the second answering nothing. The body is a word in brackets rather
# than the file: media needs a second download call, a store to put it in and a
# way to serve it, none of which exist yet, and a placeholder is honest about
# that where silence is not.
MEDIA_PLACEHOLDERS = {
    "image": "[фото]",
    "video": "[видео]",
    "audio": "[аудио]",
    "voice": "[голосовое сообщение]",
    "document": "[документ]",
    "sticker": "[стикер]",
    "location": "[геолокация]",
    "contacts": "[контакт]",
}
UNKNOWN_PLACEHOLDER = "[вложение]"

# The one refusal that is ours rather than Meta's: nothing is connected, so
# there was nowhere to send it. It lives here beside `_ERROR_MESSAGES` because
# every sentence that can end up in `messages.error` is one family and belongs
# in one file — the thread draws them all the same way and does not care which
# side decided.
NOT_CONNECTED = "Номер WhatsApp не подключён — сообщение сохранено, но не отправлено."


class WhatsAppSendError(Exception):
    """A send that WhatsApp refused, carrying words the owner can act on.

    `reason` is what goes on screen and into `messages.error`; `code` is Meta's
    number, kept for the log because that is what their documentation is
    indexed by.
    """

    def __init__(self, reason: str, code: int | None = None) -> None:
        super().__init__(reason)
        self.reason = reason
        self.code = code


# The refusals worth wording ourselves. Everything else falls through to Meta's
# own message, which is English but specific — better than a generic sentence
# that hides what happened.
_ERROR_MESSAGES: dict[int, str] = {
    # The one that will actually happen. Free-form text is only allowed within
    # 24 hours of the client's last message; after that it takes an approved
    # template, which this product does not have yet.
    131047: (
        "Прошло больше 24 часов с последнего сообщения клиента — "
        "WhatsApp разрешает написать первым только шаблоном."
    ),
    131026: "WhatsApp не может доставить сообщение на этот номер.",
    131051: "Такой тип сообщения не поддерживается.",
    131056: "Слишком много сообщений на этот номер за короткое время.",
    80007: "Слишком много запросов к WhatsApp — попробуйте через минуту.",
    190: "Токен доступа WhatsApp истёк — подключите номер заново.",
    100: "WhatsApp отклонил запрос: проверьте номер и настройки подключения.",
}


# --- proving it came from Meta -------------------------------------------


def signature_ok(raw_body: bytes, header: str | None) -> bool:
    """Whether this delivery really is Meta's.

    **The raw bytes, not the parsed body.** The digest is over exactly what was
    sent, and re-serialising the JSON changes whitespace and key order, so the
    route has to read `await request.body()` and hand it here before anything
    parses it.

    With no app secret configured every delivery is refused rather than waved
    through. That is the correct answer for a dev machine — Meta cannot reach it
    anyway — and it is the only safe default for a deployment where somebody
    forgot the variable, since the alternative is an open endpoint that writes
    into anyone's inbox.
    """
    secret = settings.whatsapp_app_secret
    if secret is None:
        logger.warning("WHATSAPP_APP_SECRET is unset — refusing the webhook delivery.")
        return False
    if not header or not header.startswith("sha256="):
        return False

    expected = hmac.new(
        secret.get_secret_value().encode("utf-8"), raw_body, hashlib.sha256
    ).hexdigest()
    # Constant time: a plain `==` leaks how much of the digest matched, which is
    # enough to forge one a byte at a time.
    return hmac.compare_digest(expected, header.removeprefix("sha256="))


def verify_token_ok(token: str | None) -> bool:
    """The one-time subscription handshake, `GET` on the same path.

    Meta asks once, when the webhook is first pointed at us, and never again.
    Unset means no, for the same reason as above.
    """
    configured = settings.whatsapp_verify_token
    if configured is None or not token:
        return False
    return hmac.compare_digest(configured.get_secret_value(), token)


# --- what a delivery says ------------------------------------------------


@dataclass(frozen=True, slots=True)
class InboundMessage:
    """A client wrote something."""

    phone_number_id: str
    # The client's own id on the channel, which is their number without a `+`.
    wa_id: str
    message_id: str
    body: str
    sent_at: datetime
    profile_name: str | None = None


@dataclass(frozen=True, slots=True)
class DeliveryReceipt:
    """How far one of ours got — `sent`, `delivered`, `read` or `failed`."""

    phone_number_id: str
    message_id: str
    status: str
    at: datetime
    error: str | None = None


@dataclass(frozen=True, slots=True)
class Delivery:
    """One webhook body, flattened.

    Meta nests everything three deep — entries, changes, then a value holding
    two unrelated lists — and a single POST can carry traffic for more than one
    number at once. Flattening here means the service loops over two plain lists
    and never walks that tree again.
    """

    messages: list[InboundMessage] = field(default_factory=list)
    receipts: list[DeliveryReceipt] = field(default_factory=list)


def parse(payload: dict[str, Any]) -> Delivery:
    """Read a webhook body. **It never raises.**

    Meta redelivers anything it did not get a 200 for, so an unfamiliar shape
    that threw would be retried forever — and the shapes are genuinely
    unfamiliar: account alerts, template approvals and phone-quality updates
    arrive on the same subscription as messages. Anything unrecognised is
    skipped and the delivery is still acknowledged.
    """
    delivery = Delivery()

    for entry in _items(payload.get("entry")):
        for change in _items(entry.get("changes")):
            value = change.get("value")
            if not isinstance(value, dict):
                continue
            phone_number_id = _phone_number_id(value)
            if not phone_number_id:
                continue

            names = _profile_names(value)
            for raw in _items(value.get("messages")):
                message = _message(raw, phone_number_id, names)
                if message is not None:
                    delivery.messages.append(message)
            for raw in _items(value.get("statuses")):
                receipt = _receipt(raw, phone_number_id)
                if receipt is not None:
                    delivery.receipts.append(receipt)

    return delivery


def _items(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _phone_number_id(value: dict[str, Any]) -> str | None:
    metadata = value.get("metadata")
    if not isinstance(metadata, dict):
        return None
    found = metadata.get("phone_number_id")
    return str(found) if found else None


def _profile_names(value: dict[str, Any]) -> dict[str, str]:
    """`wa_id` to the name the client set on WhatsApp.

    It arrives in a list beside the messages rather than on each one, which is
    why it is gathered first. It is the only name a stranger ever gives us.
    """
    names: dict[str, str] = {}
    for contact in _items(value.get("contacts")):
        wa_id = contact.get("wa_id")
        profile = contact.get("profile")
        if wa_id and isinstance(profile, dict) and profile.get("name"):
            names[str(wa_id)] = str(profile["name"])[:120]
    return names


def _message(
    raw: dict[str, Any], phone_number_id: str, names: dict[str, str]
) -> InboundMessage | None:
    wa_id = raw.get("from")
    message_id = raw.get("id")
    if not wa_id or not message_id:
        return None

    body = _body(raw)
    if body is None:
        return None

    return InboundMessage(
        phone_number_id=phone_number_id,
        wa_id=str(wa_id),
        message_id=str(message_id)[:64],
        body=body,
        sent_at=_timestamp(raw.get("timestamp")),
        profile_name=names.get(str(wa_id)),
    )


def _body(raw: dict[str, Any]) -> str | None:
    """The text of a message, whatever kind it is.

    A button or a list reply carries what the client *chose*, which is the text
    they meant to send and is what belongs in the transcript. Media becomes a
    placeholder plus its caption, since the caption is often the whole message.
    """
    kind = str(raw.get("type") or "")

    if kind == "text":
        text = raw.get("text")
        if isinstance(text, dict) and text.get("body"):
            return str(text["body"])
        return None

    if kind == "button":
        button = raw.get("button")
        if isinstance(button, dict) and button.get("text"):
            return str(button["text"])
        return None

    if kind == "interactive":
        interactive = raw.get("interactive")
        if isinstance(interactive, dict):
            for key in ("button_reply", "list_reply"):
                reply = interactive.get(key)
                if isinstance(reply, dict) and reply.get("title"):
                    return str(reply["title"])
        return None

    # `unsupported` is Meta telling us it could not render the message either;
    # there is nothing to show and no caption to find.
    if kind == "unsupported":
        return None

    placeholder = MEDIA_PLACEHOLDERS.get(kind, UNKNOWN_PLACEHOLDER)
    media = raw.get(kind)
    if isinstance(media, dict) and media.get("caption"):
        return f"{placeholder} {media['caption']}"
    return placeholder


def _receipt(raw: dict[str, Any], phone_number_id: str) -> DeliveryReceipt | None:
    message_id = raw.get("id")
    status = raw.get("status")
    if not message_id or not status:
        return None

    reason: str | None = None
    for error in _items(raw.get("errors")):
        reason = _error_message(error)
        break

    return DeliveryReceipt(
        phone_number_id=phone_number_id,
        message_id=str(message_id)[:64],
        status=str(status),
        at=_timestamp(raw.get("timestamp")),
        error=reason,
    )


def _error_message(error: dict[str, Any]) -> str:
    code = error.get("code")
    known = _ERROR_MESSAGES.get(code) if isinstance(code, int) else None
    if known:
        return known

    data = error.get("error_data")
    if isinstance(data, dict) and data.get("details"):
        return str(data["details"])
    return str(
        error.get("title") or error.get("message") or "WhatsApp отклонил сообщение."
    )


def _timestamp(value: Any) -> datetime:
    """Meta sends seconds since the epoch, as a string.

    Falls back to now rather than raising: a message whose clock we could not
    read is still a message, and putting it at the moment it reached us is a
    smaller error than losing it.
    """
    try:
        return datetime.fromtimestamp(int(value), tz=UTC)
    except (TypeError, ValueError):
        return datetime.now(UTC)


# --- sending -------------------------------------------------------------


async def send_text(
    *, phone_number_id: str, access_token: str, to: str, body: str
) -> str:
    """Send one text message. Returns the `wamid` WhatsApp gives it.

    Raises `WhatsAppSendError` on anything that is not a success, including a
    network failure — the caller has a row on screen to mark, so "it did not go"
    has to be one kind of answer rather than two.
    """
    url = (
        f"{settings.whatsapp_api_base.rstrip('/')}"
        f"/{settings.whatsapp_api_version}/{phone_number_id}/messages"
    )
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "text",
        # Off deliberately: a link preview is Meta fetching the page and pinning
        # a card to the message, which changes what the owner sees sent from
        # what they typed.
        "text": {"preview_url": False, "body": body},
    }

    try:
        async with httpx.AsyncClient(
            timeout=settings.whatsapp_timeout_seconds
        ) as client:
            response = await client.post(
                url,
                json=payload,
                headers={"Authorization": f"Bearer {access_token}"},
            )
    except httpx.HTTPError as exc:
        logger.warning("WhatsApp send could not reach the API: %s", exc)
        raise WhatsAppSendError(
            "Не удалось связаться с WhatsApp. Попробуйте ещё раз."
        ) from exc

    if response.status_code >= 400:
        raise _refusal(response)

    return _sent_id(response)


def _refusal(response: httpx.Response) -> WhatsAppSendError:
    error: dict[str, Any] = {}
    try:
        parsed = response.json()
        if isinstance(parsed, dict) and isinstance(parsed.get("error"), dict):
            error = parsed["error"]
    except ValueError:
        pass

    code = error.get("code") if isinstance(error.get("code"), int) else None
    logger.warning(
        "WhatsApp refused a send: HTTP %s, code %s, %s",
        response.status_code,
        code,
        error.get("message"),
    )
    return WhatsAppSendError(_error_message(error), code)


def _sent_id(response: httpx.Response) -> str:
    """The `wamid` out of a success, which is what delivery receipts key on.

    A 200 with a shape we cannot read is still a message that went — refusing it
    here would mark a delivered message failed, which is the worse of the two
    mistakes. It loses the receipts for that one message and nothing else.
    """
    try:
        parsed = response.json()
    except ValueError:
        return ""
    messages = parsed.get("messages") if isinstance(parsed, dict) else None
    if isinstance(messages, list) and messages and isinstance(messages[0], dict):
        return str(messages[0].get("id") or "")[:64]
    return ""
