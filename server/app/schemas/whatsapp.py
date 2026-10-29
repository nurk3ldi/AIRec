from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ConnectWhatsAppRequest(BaseModel):
    """What the owner pastes out of Meta's dashboard.

    Four of the five fields are ids and a token, typed by hand, which is why
    every one of them is stripped before it is stored: a value copied out of a
    web page arrives with a trailing space often enough that the alternative is
    a webhook that silently matches nothing.
    """

    # Not the phone number. Meta assigns an id to the number and names it in
    # every delivery; the number itself never appears in a webhook.
    phone_number_id: str = Field(max_length=32)
    # **Optional, and only on a reconnection.** The API never gives a token
    # back, so the field on screen is empty every time the card is opened —
    # which has to mean "keep the one you have" rather than "clear it", or
    # correcting a display name would silently unplug the channel. Creating a
    # connection without one is refused in the service, where the answer to
    # "is there already a token" lives.
    access_token: str | None = Field(default=None, max_length=512)
    waba_id: str | None = Field(default=None, max_length=32)
    display_phone_number: str | None = Field(default=None, max_length=32)
    verified_name: str | None = Field(default=None, max_length=120)

    @field_validator("phone_number_id")
    @classmethod
    def _required(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Заполните это поле.")
        return stripped

    @field_validator(
        "access_token", "waba_id", "display_phone_number", "verified_name"
    )
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class WhatsAppAccountPublic(BaseModel):
    """The connection, as the settings screen sees it.

    **The access token is deliberately absent.** It is a password to somebody's
    WhatsApp and nothing on a page needs it — what the screen has to say is
    which number answers and since when, which is what this carries.
    """

    model_config = ConfigDict(from_attributes=True)

    phone_number_id: str
    waba_id: str | None = None
    display_phone_number: str | None = None
    verified_name: str | None = None
    connected_at: datetime
