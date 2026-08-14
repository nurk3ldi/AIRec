from __future__ import annotations

import uuid
from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator


class BusinessPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str | None = None
    industry: str | None = None
    phone: str | None = None
    city: str | None = None
    address: str | None = None
    landmark: str | None = None
    payment_methods: str | None = None
    languages: str | None = None
    timezone: str
    capacity: int
    booking_horizon_days: int
    min_lead_minutes: int
    # Computed on the model from the stored filename.
    logo_url: str | None = None
    created_at: datetime


class UpdateBusinessRequest(BaseModel):
    """Every field optional — this is a PATCH, and an omitted field means
    "leave it alone" while an explicit `null` clears it."""

    name: str | None = Field(default=None, max_length=120)
    industry: str | None = Field(default=None, max_length=80)
    phone: str | None = Field(default=None, max_length=32)
    city: str | None = Field(default=None, max_length=80)
    address: str | None = Field(default=None, max_length=255)
    landmark: str | None = Field(default=None, max_length=255)
    payment_methods: str | None = Field(default=None, max_length=255)
    languages: str | None = Field(default=None, max_length=120)
    timezone: str | None = Field(default=None, max_length=64)
    capacity: int | None = None
    booking_horizon_days: int | None = None
    min_lead_minutes: int | None = None

    @field_validator(
        "name",
        "industry",
        "phone",
        "city",
        "address",
        "landmark",
        "payment_methods",
        "languages",
    )
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        # An emptied-out field should clear the column, not store "".
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @field_validator("timezone")
    @classmethod
    def _require_timezone(cls, value: str | None) -> str | None:
        # Unlike the rest, this one can't be cleared: bookings need a zone, and
        # a null here would silently reinterpret every stored time.
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("Укажите часовой пояс.")
        # Checked against the real database rather than merely for length: an
        # unknown name would only fail much later, inside slot generation, where
        # it reads as the calendar being broken rather than as a bad setting.
        try:
            ZoneInfo(stripped)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise ValueError("Неизвестный часовой пояс.") from exc
        return stripped

    @field_validator("capacity")
    @classmethod
    def _validate_capacity(cls, value: int | None) -> int | None:
        if value is None:
            return None
        if value < 1:
            raise ValueError("Нужно принимать хотя бы одного клиента.")
        if value > 100:
            raise ValueError("Не больше 100 одновременно.")
        return value

    @field_validator("booking_horizon_days")
    @classmethod
    def _validate_horizon(cls, value: int | None) -> int | None:
        if value is None:
            return None
        if value < 1:
            raise ValueError("Записываться можно хотя бы на сегодня.")
        if value > 365:
            raise ValueError("Не больше 365 дней.")
        return value

    @field_validator("min_lead_minutes")
    @classmethod
    def _validate_lead(cls, value: int | None) -> int | None:
        if value is None:
            return None
        if value < 0:
            raise ValueError("Значение не может быть отрицательным.")
        # A week of notice is already implausible; beyond that it is a typo that
        # would quietly leave the calendar with nothing bookable in it.
        if value > 7 * 24 * 60:
            raise ValueError("Не больше 7 дней.")
        return value
