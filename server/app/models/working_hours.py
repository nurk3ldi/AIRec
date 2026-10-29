from __future__ import annotations

import uuid
from datetime import time
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, Time, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.business import Business


class WorkingHours(Base):
    """One weekday's opening hours, with an optional break.

    Seven rows per business, always — a missing row and a closed day would be
    indistinguishable otherwise, and "we never set that up" has to read
    differently from "we are shut on Sundays".

    Times are stored as `time`, not text: they are compared against booking
    times constantly, and a string comparison only happens to work while every
    value is zero-padded.
    """

    __tablename__ = "working_hours"
    __table_args__ = (
        UniqueConstraint("business_id", "weekday", name="uq_working_hours_business_day"),
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

    # 0 = Monday … 6 = Sunday, matching `datetime.weekday()` so no translation
    # is needed when a booking date is checked against the schedule.
    weekday: Mapped[int] = mapped_column(Integer, nullable=False)

    # Null on both means the day is closed — unless `is_24h` is set.
    opens_at: Mapped[time | None] = mapped_column(Time, nullable=True)
    closes_at: Mapped[time | None] = mapped_column(Time, nullable=True)

    break_starts_at: Mapped[time | None] = mapped_column(Time, nullable=True)
    break_ends_at: Mapped[time | None] = mapped_column(Time, nullable=True)

    # Round the clock, as its own flag rather than 00:00–00:00 or 00:00–23:59.
    # Both of those encodings are guesses a reader has to decode, and the second
    # one silently loses a minute every day — which a slot generator would then
    # have to know to forgive. A boolean says it outright, and leaves the two
    # time columns null so nothing can disagree with it.
    is_24h: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )

    business: Mapped[Business] = relationship()

    @property
    def is_open(self) -> bool:
        return self.is_24h or (self.opens_at is not None and self.closes_at is not None)

    def __repr__(self) -> str:
        return f"<WorkingHours day={self.weekday} open={self.is_open}>"
