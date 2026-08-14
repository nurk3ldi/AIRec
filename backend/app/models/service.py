from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.business import Business


class Service(Base):
    """One line of the price list.

    Belongs to the business, not the owner — the assistant quotes these, and a
    business will eventually have staff who can perform some of them.
    """

    __tablename__ = "services"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    # Minutes rather than an interval: every booking calculation is arithmetic
    # on a slot count, and an interval would be converted back on every read.
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    # Whole tenge. No sub-unit exists in practice, and an integer keeps the
    # arithmetic exact where a float would not.
    price: Mapped[int] = mapped_column(Integer, nullable=False)
    # Hidden services stay in the list but are never offered to a client — a
    # seasonal service or one whose master is away.
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )
    # The owner's chosen order. Without it the list would reshuffle on every
    # read, and a price list has a deliberate order.
    position: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
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
        return f"<Service {self.name} ({self.price})>"
