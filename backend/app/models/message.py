from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.conversation import Conversation


class MessageAuthor(StrEnum):
    """Who wrote it.

    **One column instead of two.** A direction column would say inbound or
    outbound, which this already implies — the client is the only one on the
    other end — while leaving the question that actually matters unanswered: an
    outbound message written by the assistant and one written by the owner are
    different events, and the whole `assistant_enabled` rule turns on telling
    them apart.
    """

    CLIENT = "client"
    ASSISTANT = "assistant"
    OWNER = "owner"


# Everything we send. Kept beside the enum rather than spelled out at each call
# site, because "is this ours" is asked in more than one place and a list that
# is wrong in one of them is a bug nobody sees until a client is answered twice.
OUTBOUND_AUTHORS = (MessageAuthor.ASSISTANT, MessageAuthor.OWNER)


class MessageStatus(StrEnum):
    """How far one of *our* messages has got.

    Four of these are WhatsApp's own words back to us, and `PENDING` is the one
    we say ourselves: the row exists and the provider has not accepted it yet.
    It is a real state rather than a placeholder, because writing the message
    down happens before sending it and a send can fail — a message the owner
    typed and WhatsApp refused is a fact worth keeping on screen, not a row to
    delete.

    **Inbound messages have no status at all** (the column is NULL for them).
    Delivery is a claim about something we sent; a message that arrived has
    arrived, and inventing a `received` value would put a word in the column
    that nothing ever reads.
    """

    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"


# **Delivery receipts do not arrive in order.** A `read` can land before the
# `delivered` for the same message, and applying them as they come would walk a
# message backwards on screen. Rank says which of two states is further along,
# so an older one is simply dropped; `FAILED` is deliberately the highest,
# since a failure reported after a `sent` is the provider correcting itself and
# is the answer that matters.
STATUS_RANK = {
    MessageStatus.PENDING: 0,
    MessageStatus.SENT: 1,
    MessageStatus.DELIVERED: 2,
    MessageStatus.READ: 3,
    MessageStatus.FAILED: 4,
}


class Message(Base):
    """One message in a thread.

    Stored as it was sent and never edited: a message that has left for WhatsApp
    cannot be changed there, so a row that could be changed here would be a
    record disagreeing with the thing it records. `DELETE` exists, and it
    removes our copy — it does not unsend anything.
    """

    __tablename__ = "messages"
    __table_args__ = (
        CheckConstraint("author in ('client', 'assistant', 'owner')", name="author"),
        CheckConstraint(
            "status is null or status in "
            "('pending', 'sent', 'delivered', 'read', 'failed')",
            name="status",
        ),
        # The provider's own id, which is what makes a redelivered webhook
        # harmless: the same message arriving twice hits this and is dropped
        # rather than appended. Scoped by conversation because those ids are
        # only promised unique within a thread.
        UniqueConstraint(
            "conversation_id", "external_id", name="conversation_id_external_id"
        ),
        # Every read is "this thread, in order", so the pair is the index.
        Index("ix_messages_conversation_sent", "conversation_id", "sent_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    author: Mapped[str] = mapped_column(String(16), nullable=False)
    # `Text`, not a bounded string: the schema caps what a client of ours may
    # send, but an inbound message is whatever the provider hands over, and a
    # column that refused it would lose the message rather than the argument.
    body: Mapped[str] = mapped_column(Text, nullable=False)
    external_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # How far this one got, and NULL for anything the client sent — see
    # `MessageStatus`. Updated by delivery receipts, which arrive out of order,
    # so `STATUS_RANK` and not a bare assignment is what applies them.
    status: Mapped[str | None] = mapped_column(String(16), nullable=True)
    # Why it failed, in words the owner can act on. Meta answers with a numeric
    # code and a sentence; the sentence is what goes here, because "вне
    # 24-часового окна" tells somebody what to do and `131047` does not.
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    # When it was actually sent, which is the provider's word and not ours — a
    # webhook arriving late must not reorder a thread. `created_at` is when this
    # row appeared, and the two are different facts.
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    conversation: Mapped[Conversation] = relationship(back_populates="messages")
