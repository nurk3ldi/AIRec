from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class Business(Base):
    """The company the assistant answers on behalf of.

    Everything the receptionist needs to know about *what it is selling* hangs
    off this row rather than off `users`: services, hours and bookings belong to
    the business, not to the person who happens to be signed in, and a business
    will eventually have more than one person attached to it.

    One per account for now — `owner_id` is unique — but the shape is already
    the one a staff roster can be added to without a rewrite.
    """

    __tablename__ = "businesses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(80), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    city: Mapped[str | None] = mapped_column(String(80), nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # "Напротив Dostyk Plaza, 2 этаж" — the thing clients actually ask for, and
    # the reason a street address alone isn't enough.
    landmark: Mapped[str | None] = mapped_column(String(255), nullable=True)
    payment_methods: Mapped[str | None] = mapped_column(String(255), nullable=True)
    languages: Mapped[str | None] = mapped_column(String(120), nullable=True)
    # Not optional, and set before any booking exists: a time stored without
    # knowing the zone it belongs to can't be repaired afterwards.
    timezone: Mapped[str] = mapped_column(
        String(64), nullable=False, default="Asia/Almaty"
    )

    # --- booking rules ---------------------------------------------------
    # How many bookings may overlap: one chair or three. Without it the
    # assistant cannot tell a full hour from an empty one, so it defaults to the
    # safe answer rather than to "unlimited".
    capacity: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default=text("1")
    )
    # How far ahead a client may book. An open-ended calendar invites bookings
    # for a date the business has no idea about yet.
    booking_horizon_days: Mapped[int] = mapped_column(
        Integer, nullable=False, default=60, server_default=text("60")
    )
    # How much warning the business needs. Without it the assistant will happily
    # book someone in four minutes' time.
    min_lead_minutes: Mapped[int] = mapped_column(
        Integer, nullable=False, default=60, server_default=text("60")
    )

    # Filename only, not a full URL — the serving prefix comes from
    # `LOGO_STORE`, so moving storage doesn't rewrite rows.
    logo_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    owner: Mapped[User] = relationship()

    @property
    def logo_url(self) -> str | None:
        from app.core.images import LOGO_STORE, image_url

        return image_url(LOGO_STORE, self.logo_filename)

    def __repr__(self) -> str:
        return f"<Business {self.name or '(без названия)'}>"
