from __future__ import annotations

import uuid
from datetime import time

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator

MAX_SERVICE_MINUTES = 24 * 60
MAX_SERVICE_PRICE = 100_000_000


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


class WorkingHoursListInput(BaseModel):
    days: list[WorkingHoursInput]
