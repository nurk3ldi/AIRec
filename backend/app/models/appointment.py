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
    Integer,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.business import Business
    from app.models.service import Service


class AppointmentStatus(StrEnum):
    """Where a booking is in its life.

    `PENDING` is what the assistant creates: agreed with the client but not yet
    looked at by the owner. Everything else is the owner's word.
    """

    PENDING = "pending"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class AppointmentSource(StrEnum):
    WHATSAPP = "whatsapp"
    MANUAL = "manual"


# Only a cancellation gives the time back. A no-show or a completed booking
# still happened *to that slot*, and treating them as free would let the past be
# double-booked the moment anyone looked at it.
BLOCKING_STATUSES = (
    AppointmentStatus.PENDING,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.COMPLETED,
    AppointmentStatus.NO_SHOW,
)


class Appointment(Base):
    """One booking.

    The service it was booked from is kept as a foreign key *and* copied into
    this row — name, duration and price. That duplication is deliberate: the
    price list is edited constantly, and without a snapshot, correcting one
    price would silently rewrite what every past booking cost. The key is what
    links a booking to a living service; the copy is what the booking *was*.

    Times are stored timezone-aware in UTC. The business's own zone lives on
    `businesses.timezone` and is applied when a local day is turned into a range
    — a booking's instant is absolute, its wall-clock reading is not.
    """

    __tablename__ = "appointments"
    __table_args__ = (
        # Bare names on purpose: `NAMING_CONVENTION` renders these as
        # `ck_appointments_<name>`, and spelling the prefix out here would get
        # it applied twice.
        CheckConstraint(
            "status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')",
            name="status",
        ),
        CheckConstraint("ends_at > starts_at", name="span"),
        CheckConstraint("duration_minutes > 0", name="duration"),
        # Every listing and every overlap check is "this business, this time
        # range", so the pair is the index rather than the timestamp alone.
        Index("ix_appointments_business_starts", "business_id", "starts_at"),
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
    # SET NULL, not CASCADE: removing a service from the price list must not
    # erase the bookings that were made from it.
    service_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("services.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Snapshots, taken once at booking time and never refreshed.
    service_name: Mapped[str] = mapped_column(String(120), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    price: Mapped[int] = mapped_column(Integer, nullable=False)

    client_name: Mapped[str] = mapped_column(String(120), nullable=False)
    client_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)

    starts_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    # Derived from `starts_at + duration_minutes`, but stored: every availability
    # check is a range overlap, and computing the end in SQL on each comparison
    # would rule out using an index for it. `AppointmentService` is the only
    # writer, so the two cannot drift.
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    status: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=AppointmentStatus.PENDING,
        server_default=AppointmentStatus.PENDING,
    )
    source: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=AppointmentSource.MANUAL,
        server_default=AppointmentSource.MANUAL,
    )
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)

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
    service: Mapped[Service | None] = relationship()

    @property
    def blocks_slot(self) -> bool:
        return self.status in BLOCKING_STATUSES

    def __repr__(self) -> str:
        return f"<Appointment {self.client_name} {self.starts_at:%Y-%m-%d %H:%M}>"
