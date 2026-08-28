from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.business import Business
    from app.models.message import Message


class ConversationChannel(StrEnum):
    """Where the conversation is happening.

    One value today and a column anyway: the assistant will not stay on
    WhatsApp forever, and a channel added later must not be a migration that
    rewrites every row's identity. `external_id` means nothing without it — the
    same phone number is a different thread on a different channel.
    """

    WHATSAPP = "whatsapp"


class ConversationStatus(StrEnum):
    """What the owner still has to do about it.

    Three, and each is a different answer to that question. `NEW` is a client
    nobody has answered yet — the assistant included, so it is genuinely
    untouched. `OPEN` is under way. `CLOSED` is dealt with, and is the only one
    a person sets by hand; the system moves between the other two on its own.

    Deliberately *not* statuses: whether the conversation is live this minute,
    and whether it is waiting on us. Both are facts about the last message and
    would go stale the moment nobody updated them — a thread marked "active" at
    two o'clock is still marked active at midnight. They are derived instead,
    from `last_message_at` and `last_message_author`.
    """

    NEW = "new"
    OPEN = "open"
    CLOSED = "closed"


class Conversation(Base):
    """One thread with one client.

    **The last message is copied onto this row** — when it arrived, who wrote
    it, and its opening words. That is a denormalisation on purpose and for the
    same reason `appointments.ends_at` is stored rather than computed: the list
    screen is "every conversation, newest first, with a line of preview", and
    getting the newest message per thread out of SQL is a lateral join or a
    window function on every read. `ConversationService` is the only writer of
    all three, so they cannot drift from the message table.

    **`assistant_enabled` is a switch, not a log.** It is a boolean because
    what the UI needs is a toggle and what the send path needs is a yes or no;
    "when was it switched off" is a question nothing asks, so no timestamp is
    kept for it.
    """

    __tablename__ = "conversations"
    __table_args__ = (
        # Bare names: `NAMING_CONVENTION` renders these as
        # `ck_conversations_<name>`, and spelling the prefix here applies it
        # twice.
        CheckConstraint("status in ('new', 'open', 'closed')", name="status"),
        CheckConstraint("channel in ('whatsapp')", name="channel"),
        CheckConstraint("unread_count >= 0", name="unread"),
        # One thread per client per channel. The provider's own id is what
        # identifies it — the phone number can be edited by the owner, the
        # `external_id` cannot — and it is scoped by business because two
        # accounts may perfectly well both talk to the same person.
        UniqueConstraint(
            "business_id",
            "channel",
            "external_id",
            name="business_id_channel_external_id",
        ),
        # The list is always "this business, newest first", so the pair is the
        # index rather than either column alone.
        Index("ix_conversations_business_last", "business_id", "last_message_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    channel: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=ConversationChannel.WHATSAPP,
        server_default=ConversationChannel.WHATSAPP,
    )
    # The provider's thread id — a `wa_id` on WhatsApp. Nullable because a
    # conversation can also be opened from this side before the channel has
    # ever seen it, and it is filled in when the first real message lands.
    external_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # The number is the identity on this channel; the name is whatever the
    # owner has managed to learn, which for a stranger is nothing at all.
    client_phone: Mapped[str] = mapped_column(String(32), nullable=False)
    client_name: Mapped[str | None] = mapped_column(String(120), nullable=True)

    status: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=ConversationStatus.NEW,
        server_default=ConversationStatus.NEW,
    )

    # **Off the moment a person from the business writes**, and it stays off for
    # this thread until somebody switches it back on — see
    # `ConversationService.add_message`. Two voices answering one client is the
    # single worst thing this product could do, so the safe state is the
    # automatic one and turning it back on is a deliberate act.
    assistant_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    # --- the last message, copied here; see the class docstring --------------
    last_message_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_message_author: Mapped[str | None] = mapped_column(String(16), nullable=True)
    # A line, not the message: this is what a list row shows, and storing the
    # whole body twice would make the copy as expensive as the join it avoids.
    last_message_preview: Mapped[str | None] = mapped_column(
        String(160), nullable=True
    )

    # How many the owner has not looked at. Cleared by reading the thread, not
    # by the assistant answering it — the assistant replying is exactly the case
    # where the owner still wants to know something happened.
    unread_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )

    # Out of the list's way, still in the history — the same view flag
    # `appointments.archived_at` is, and a timestamp for the same reason: "when
    # was this put away" is free, and NULL is the only value that can mean
    # "never was".
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # «Избранное». A timestamp again, so a starred list can be ordered by when
    # each was starred without a second column to carry that.
    starred_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # «Закрепить» — kept at the top of the inbox whatever its last message says.
    #
    # **Its own column rather than a second reading of `starred_at`**, because
    # the two are different kinds of answer: starring says which *list* a thread
    # belongs to, pinning says where it sits inside whichever list is showing.
    # A timestamp for the usual reason, and here it also does real work — when
    # several are pinned, the order they were pinned in is the order to draw
    # them in, and the column already carries it.
    pinned_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # One-directional, like `Appointment.business`: nothing walks from a
    # business to its threads, and a back-reference nobody reads is a second
    # thing to keep loaded.
    business: Mapped[Business] = relationship()
    messages: Mapped[list[Message]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    @property
    def archived(self) -> bool:
        return self.archived_at is not None

    @property
    def starred(self) -> bool:
        return self.starred_at is not None

    @property
    def pinned(self) -> bool:
        return self.pinned_at is not None

    @property
    def awaiting_reply(self) -> bool:
        """Whether the ball is with the business.

        Derived rather than stored — see `ConversationStatus`. The last message
        being the client's is the whole of it: anything we sent, assistant or
        owner, means it is their turn.
        """
        from app.models.message import MessageAuthor

        return self.last_message_author == MessageAuthor.CLIENT
