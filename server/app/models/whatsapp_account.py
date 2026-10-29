from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.business import Business


class WhatsAppAccount(Base):
    """The number a business answers on, and the credential that speaks for it.

    **A table of its own rather than columns on `businesses`**, for two reasons
    that are both about the access token. A business row is the salon's
    identity — its name, its hours, its timezone — and it is what `GET
    /business` returns; a permanent credential has no business travelling
    beside data that is read on every page load, and keeping it out of that row
    means no future field added to `BusinessPublic` can leak it by accident.
    The other reason is lifecycle: a connection is made, breaks, and is
    remade, which is a row that appears and disappears rather than a column
    that is sometimes null.

    One per business for now — `business_id` is unique — the same shape
    `Business.owner_id` has, and for the same reason: a second number is a
    thing to add later, not a thing to half-support now.

    **`phone_number_id` is the identity, not the phone number.** A webhook
    arrives naming the id Meta assigned to the number, never the number itself,
    so that is what the delivery is resolved by and that is what carries the
    unique index. `display_phone_number` is kept only so the owner can see
    which of their numbers this is.
    """

    __tablename__ = "whatsapp_accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # What every inbound delivery names itself by, and the path segment every
    # send goes to. Unique across the deployment: two businesses cannot share
    # one number, and if they appear to, one of them has mistyped an id and the
    # database says so rather than quietly routing a stranger's messages into
    # somebody's inbox.
    phone_number_id: Mapped[str] = mapped_column(
        String(32), nullable=False, unique=True, index=True
    )
    # The WhatsApp Business Account the number belongs to. Nothing routes by it
    # today; it is what a later "list this account's numbers" call needs, and
    # it is free to record while the owner is already pasting ids in.
    waba_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # "+7 701 000 00 00" as Meta prints it — for the owner's eyes only.
    display_phone_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    verified_name: Mapped[str | None] = mapped_column(String(120), nullable=True)

    # **Stored as it was given, and that is a deliberate limit worth naming.**
    # A permanent token is a password to somebody's WhatsApp, and this column
    # holds it in the clear — the same way nothing else in this project is
    # encrypted at rest, because the database is the trust boundary and adding
    # one key here would be a key with nowhere safe to live. It never leaves
    # the server: no schema exposes it, and `WhatsAppAccountPublic` reports
    # only whether one is set.
    access_token: Mapped[str] = mapped_column(Text, nullable=False)

    connected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
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

    business: Mapped[Business] = relationship()

    def __repr__(self) -> str:
        return f"<WhatsAppAccount {self.display_phone_number or self.phone_number_id}>"
