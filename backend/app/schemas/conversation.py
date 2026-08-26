from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.conversation import ConversationChannel, ConversationStatus
from app.models.message import MessageAuthor

# What WhatsApp itself accepts in one text message. Enforced here rather than
# on the column, because an *inbound* message is whatever the provider hands
# over and a column that refused it would lose the message instead of the
# argument — see `Message.body`.
MAX_BODY_LENGTH = 4096
# How much of the last message is copied onto the conversation row. One line of
# a list, not a message; see `Conversation.last_message_preview`.
PREVIEW_LENGTH = 160


class MessagePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    conversation_id: uuid.UUID
    author: str
    body: str
    external_id: str | None = None
    sent_at: datetime
    created_at: datetime


class ConversationPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    channel: str
    external_id: str | None = None
    client_phone: str
    client_name: str | None = None
    status: str
    assistant_enabled: bool
    last_message_at: datetime | None = None
    last_message_author: str | None = None
    last_message_preview: str | None = None
    unread_count: int
    # Computed on the model — see `Conversation`. `archived` and `starred` from
    # their timestamps, `awaiting_reply` from who wrote last.
    archived: bool = False
    starred: bool = False
    awaiting_reply: bool = False
    created_at: datetime
    updated_at: datetime


class ConversationWithMessages(ConversationPublic):
    """One thread, opened.

    The list never carries messages — a hundred rows each dragging their
    history behind them is the reason list endpoints get slow — so this is the
    shape only `GET /conversations/{id}` returns.
    """

    messages: list[MessagePublic] = Field(default_factory=list)


def _clean_phone(value: str) -> str:
    """A number is stored as it was typed, minus the surrounding whitespace.

    Not normalised to digits: the owner may have written it the way they read
    it back, and rewriting «+7 701 000 00 00» into a run of digits makes the
    field harder to check at a glance. Searching already strips punctuation on
    both sides, so nothing depends on the stored shape.
    """
    cleaned = value.strip()
    if not cleaned:
        raise ValueError("Укажите номер телефона.")
    if not any(character.isdigit() for character in cleaned):
        raise ValueError("Номер телефона должен содержать цифры.")
    return cleaned


class CreateConversationRequest(BaseModel):
    """Opening a thread from this side.

    The ordinary way one appears is a client writing first, which the channel
    does through `ingest`. This is the other way: the owner starting one, and
    the reason it exists at all is that the *messages* endpoint needs somewhere
    to put a first message before the provider has ever seen this number.
    """

    client_phone: str = Field(max_length=32)
    client_name: str | None = Field(default=None, max_length=120)
    channel: ConversationChannel = ConversationChannel.WHATSAPP
    external_id: str | None = Field(default=None, max_length=64)

    @field_validator("client_phone")
    @classmethod
    def _validate_phone(cls, value: str) -> str:
        return _clean_phone(value)

    @field_validator("client_name")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class UpdateConversationRequest(BaseModel):
    """A PATCH: an omitted field is left alone.

    Everything here is the owner's own decision about a thread — what to call
    the client, whether it is dealt with, whether it is out of the way, whether
    it is starred, and **whether the assistant may speak in it**. Nothing here
    writes a message, so nothing here can flip the assistant off by accident;
    that only happens where an owner actually says something.
    """

    client_name: str | None = Field(default=None, max_length=120)
    status: ConversationStatus | None = None
    assistant_enabled: bool | None = None
    archived: bool | None = None
    starred: bool | None = None

    @field_validator("client_name")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class CreateMessageRequest(BaseModel):
    """Something we are saying.

    `author` defaults to the owner because this endpoint is the panel's reply
    box; the assistant passes itself explicitly when it answers on its own. The
    difference is not cosmetic — an owner's message switches the assistant off
    for that thread and the assistant's does not.

    The client is deliberately **not** one of the choices: a message from them
    arrives through the channel, and letting an authenticated request claim to
    be the client would be letting the business write the other half of its own
    transcript.
    """

    body: str = Field(max_length=MAX_BODY_LENGTH)
    author: MessageAuthor = MessageAuthor.OWNER
    sent_at: datetime | None = None

    @field_validator("body")
    @classmethod
    def _validate_body(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Введите текст сообщения.")
        return stripped

    @field_validator("author")
    @classmethod
    def _validate_author(cls, value: MessageAuthor) -> MessageAuthor:
        if value is MessageAuthor.CLIENT:
            raise ValueError("Сообщение клиента приходит из канала.")
        return value


class IngestMessageRequest(BaseModel):
    """What the channel hands over when a client writes.

    Separate from `CreateMessageRequest` on purpose. This one carries the
    client's number, because the thread it belongs to may not exist yet, and
    the provider's own message id, because a webhook is redelivered on any
    doubt and the second copy has to be recognised rather than appended. Its
    author is always the client — that is the whole of what "inbound" means.
    """

    client_phone: str = Field(max_length=32)
    body: str = Field(max_length=MAX_BODY_LENGTH)
    client_name: str | None = Field(default=None, max_length=120)
    channel: ConversationChannel = ConversationChannel.WHATSAPP
    external_id: str | None = Field(default=None, max_length=64)
    message_external_id: str | None = Field(default=None, max_length=64)
    sent_at: datetime | None = None

    @field_validator("client_phone")
    @classmethod
    def _validate_phone(cls, value: str) -> str:
        return _clean_phone(value)

    @field_validator("body")
    @classmethod
    def _validate_body(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Введите текст сообщения.")
        return stripped
