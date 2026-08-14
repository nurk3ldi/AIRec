from __future__ import annotations

import uuid
from datetime import time

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator

MAX_SERVICE_MINUTES = 24 * 60
MAX_SERVICE_PRICE = 100_000_000

# Everything the assistant will ever have to line up — a service, an opening
# time, a break — sits on the same 15-minute grid. Booking is fitting durations
# into gaps between hours, and that arithmetic only stays exact while both sides
# share one unit; a 40-minute service against a 10:05 opening leaves offcuts no
# other booking can fill. Enforced here rather than trusted to the pickers,
# since the pickers are not the only possible client.
SLOT_MINUTES = 15


class ServicePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    duration_minutes: int
    price: int
    is_active: bool


class ServiceInput(BaseModel):
    """One line of a submitted price list.

    `id` is optional: a row that has one is an edit, a row without is new. That
    is what lets the whole list be sent in a single request without the ids of
    untouched rows changing underneath the client.
    """

    id: uuid.UUID | None = None
    name: str = Field(max_length=120)
    duration_minutes: int
    price: int
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def _require_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Укажите название услуги.")
        return stripped

    @field_validator("duration_minutes")
    @classmethod
    def _validate_duration(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("Укажите длительность.")
        if value > MAX_SERVICE_MINUTES:
            raise ValueError("Не больше 24 часов.")
        if value % SLOT_MINUTES:
            raise ValueError("Длительность должна быть кратна 15 минутам.")
        return value

    @field_validator("price")
    @classmethod
    def _validate_price(cls, value: int) -> int:
        if value < 0:
            raise ValueError("Цена не может быть отрицательной.")
        if value > MAX_SERVICE_PRICE:
            raise ValueError("Слишком большая цена.")
        return value


class ServiceListInput(BaseModel):
    """The price list as a whole.

    Sent complete rather than as a stream of per-row calls, because that is how
    it is edited: the owner fixes three prices and renames one service, then
    presses Save once. One request also means the list can never be left half
    applied.
    """

    services: list[ServiceInput]


def _format_time(value: time | None) -> str | None:
    return value.strftime("%H:%M") if value else None


class WorkingHoursPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    weekday: int
    opens_at: time | None = None
    closes_at: time | None = None
    break_starts_at: time | None = None
    break_ends_at: time | None = None
    is_24h: bool = False

    # "10:00", not "10:00:00" — seconds are noise the client would strip anyway.
    @field_serializer("opens_at", "closes_at", "break_starts_at", "break_ends_at")
    def _serialize_time(self, value: time | None) -> str | None:
        return _format_time(value)


class WorkingHoursInput(BaseModel):
    weekday: int = Field(ge=0, le=6)
    opens_at: time | None = None
    closes_at: time | None = None
    break_starts_at: time | None = None
    break_ends_at: time | None = None
    is_24h: bool = False

    @field_validator(
        "opens_at", "closes_at", "break_starts_at", "break_ends_at"
    )
    @classmethod
    def _on_the_grid(cls, value: time | None) -> time | None:
        # Seconds are dropped rather than rejected: a client sending "10:00:00"
        # means ten o'clock, and refusing it would only punish the format.
        if value is None:
            return None
        if value.minute % SLOT_MINUTES:
            raise ValueError("Время должно быть кратно 15 минутам.")
        return value.replace(second=0, microsecond=0)


class WorkingHoursListInput(BaseModel):
    days: list[WorkingHoursInput]
