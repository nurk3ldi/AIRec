from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.appointment import AppointmentSource, AppointmentStatus

MAX_NOTE_LENGTH = 500


def _require_aware(value: datetime) -> datetime:
    """A naive datetime is a bug waiting for a plane ticket.

    Rejected rather than assumed to be UTC or business-local: both guesses are
    silently wrong for half the callers, and the client already knows which one
    it meant. Seconds are dropped, since a stray `:00.123` would only ever come
    from a serialiser.

    **A booking no longer has to start on the quarter hour.** It did, and
    `SLOT_MINUTES` still governs everything the *client* is offered — working
    hours, breaks, and the starts `available_slots` generates — because that is
    the arithmetic of fitting durations into gaps, and it stays exact only while
    both sides share one unit.

    A booking written down by the owner is not that. It is a record of when
    somebody actually sat down, which is 14:07 as often as it is 14:00, and
    rounding it to keep a generator tidy would be filing the day wrong to make
    the maths pretty. Overlap checks are range comparisons and do not care.
    """
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("Укажите время вместе с часовым поясом.")
    return value.replace(second=0, microsecond=0)


class AppointmentPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    # Null once the service has been removed from the price list; the snapshot
    # below still says what was booked.
    service_id: uuid.UUID | None = None
    service_name: str
    duration_minutes: int
    price: int
    client_name: str
    client_phone: str | None = None
    starts_at: datetime
    ends_at: datetime
    status: str
    source: str
    note: str | None = None
    # Computed on the model from `archived_at`.
    archived: bool = False
    created_at: datetime


MAX_DURATION_MINUTES = 24 * 60


class CreateAppointmentRequest(BaseModel):
    service_id: uuid.UUID
    client_name: str = Field(max_length=120)
    client_phone: str | None = Field(default=None, max_length=32)
    starts_at: datetime
    # How long this particular booking runs, when it is not the service's usual
    # length. Optional, and omitting it keeps the old behaviour exactly: the
    # service decides.
    #
    # It exists because the panel lets the owner set both ends of a booking by
    # hand. A service is a price-list entry — "стрижка, 30 минут" — and what
    # actually happened on the day is regularly not that: the client came for
    # two things, or it ran long, and the owner is writing down the hour that
    # was used rather than the hour that was quoted. Refusing that would make
    # the calendar a record of the price list instead of a record of the day.
    #
    # The snapshot on the row takes this value, so a booking still carries the
    # length it was actually made for — see the note on `service_name`.
    duration_minutes: int | None = Field(
        default=None, ge=1, le=MAX_DURATION_MINUTES
    )
    note: str | None = Field(default=None, max_length=MAX_NOTE_LENGTH)
    # The owner adding a booking by hand may write it down as already agreed;
    # the assistant leaves it pending for the owner to look at.
    status: AppointmentStatus = AppointmentStatus.PENDING
    # Where it came from. Defaults to the panel, since that is the only caller
    # that exists yet — the assistant will say so for itself.
    source: AppointmentSource = AppointmentSource.MANUAL

    @field_validator("client_name")
    @classmethod
    def _require_client_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Укажите имя клиента.")
        return stripped

    @field_validator("client_phone", "note")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None

    @field_validator("starts_at")
    @classmethod
    def _validate_start(cls, value: datetime) -> datetime:
        return _require_aware(value)


class UpdateAppointmentRequest(BaseModel):
    """A PATCH: an omitted field is left alone.

    `starts_at` is here rather than on a separate reschedule endpoint because
    moving a booking is the same act as editing it — and it goes through exactly
    the same availability checks either way.

    `service_id` likewise: a client who asks for a different haircut on arrival
    has changed the same booking, not made another one. It re-snapshots the
    name, the length and the price, which is why it can change how long the
    booking runs and so has to be re-checked exactly like a new start time.
    """

    service_id: uuid.UUID | None = None
    client_name: str | None = Field(default=None, max_length=120)
    client_phone: str | None = Field(default=None, max_length=32)
    starts_at: datetime | None = None
    note: str | None = Field(default=None, max_length=MAX_NOTE_LENGTH)
    status: AppointmentStatus | None = None
    # Out of the calendar's way, or back into it. A view flag — it changes
    # nothing about when the booking is or whether its hour is free.
    archived: bool | None = None

    @field_validator("client_name")
    @classmethod
    def _require_client_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("Укажите имя клиента.")
        return stripped

    @field_validator("client_phone", "note")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None

    @field_validator("starts_at")
    @classmethod
    def _validate_start(cls, value: datetime | None) -> datetime | None:
        return None if value is None else _require_aware(value)


class SlotsQuery(BaseModel):
    """The question the assistant asks most: when can this be booked?"""

    service_id: uuid.UUID
    day: date


class DaySlots(BaseModel):
    day: date
    # Every start the service fits into, already filtered by hours, breaks,
    # existing bookings, notice and horizon — so the caller never has to
    # re-derive any of those rules to know what it may offer.
    slots: list[datetime]
