from __future__ import annotations

import uuid
from datetime import datetime

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
        return stripped
