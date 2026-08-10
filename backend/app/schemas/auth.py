from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

USERNAME_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9_.-]{2,31}$")
USERNAME_MESSAGE = "Логин: только латинские буквы, цифры, _ . и -"

RESET_CODE_PATTERN = re.compile(r"^\d{6}$")
RESET_CODE_MESSAGE = "Код состоит из 6 цифр."

# Argon2 has no bcrypt-style truncation, but an unbounded password is a cheap
# way to burn CPU, so cap it.
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128
PASSWORD_LENGTH_MESSAGE = (
    f"Пароль должен быть от {PASSWORD_MIN_LENGTH} до {PASSWORD_MAX_LENGTH} символов."
)

# Latin letters, digits, and common keyboard symbols — no whitespace, no
# non-Latin scripts. Keeps passwords copy-pasteable and free of characters
# that tend to cause encoding surprises across clients.
PASSWORD_CHARSET_PATTERN = re.compile(r"^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{}|;:,.<>?]+$")
PASSWORD_CHARSET_MESSAGE = (
    "Пароль может содержать только латинские буквы, цифры и символы."  # noqa: S105
)

# Length is checked in a validator rather than via `Field(min_length=...)` so
# the message is ours — Pydantic's built-in one is English and can't be swapped.
Password = str


def validate_password_length(value: str) -> str:
    if not PASSWORD_MIN_LENGTH <= len(value) <= PASSWORD_MAX_LENGTH:
        raise ValueError(PASSWORD_LENGTH_MESSAGE)
    return value


def validate_new_password(value: str) -> str:
    """For endpoints that store a *new* password (register, reset): length plus
    charset. Login only checks length — an already-stored password was valid by
    construction, so re-checking its charset could lock someone out."""
    validate_password_length(value)
    if not PASSWORD_CHARSET_PATTERN.match(value):
        raise ValueError(PASSWORD_CHARSET_MESSAGE)
    return value


class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: Password

    @field_validator("email")
    @classmethod
    def _normalise_email(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("username")
    @classmethod
    def _validate_username(cls, value: str) -> str:
        stripped = value.strip()
        if not USERNAME_PATTERN.match(stripped):
            raise ValueError(USERNAME_MESSAGE)
        return stripped

    _validate_password = field_validator("password")(validate_new_password)


class LoginRequest(BaseModel):
    """The login form accepts either an email or a username in one field."""

    identifier: str
    password: Password

    _check_password = field_validator("password")(validate_password_length)

    @field_validator("identifier")
    @classmethod
    def _normalise_identifier(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Введите логин или email.")
        return stripped


class RefreshRequest(BaseModel):
    refresh_token: Annotated[str, Field(min_length=16, max_length=512)]


class UsernameAvailability(BaseModel):
    available: bool


class MessageResponse(BaseModel):
    message: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def _normalise_email(cls, value: str) -> str:
        return value.strip().lower()


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: Password

    @field_validator("email")
    @classmethod
    def _normalise_email(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("code")
    @classmethod
    def _validate_code(cls, value: str) -> str:
        stripped = value.strip()
        if not RESET_CODE_PATTERN.match(stripped):
            raise ValueError(RESET_CODE_MESSAGE)
        return stripped

    _validate_new_password = field_validator("new_password")(validate_new_password)


class UpdateProfileRequest(BaseModel):
    """Every field optional — this is a PATCH, and an omitted field means
    "leave it alone" while an explicit `null` clears it."""

    full_name: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=32)
    username: str | None = None
    email: EmailStr | None = None

    @field_validator("email")
    @classmethod
    def _normalise_email(cls, value: str | None) -> str | None:
        return value.strip().lower() if value else value

    @field_validator("username")
    @classmethod
    def _validate_username(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not USERNAME_PATTERN.match(stripped):
            raise ValueError(USERNAME_MESSAGE)
        return stripped

    @field_validator("full_name", "phone")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        # An emptied-out optional field should clear the column, not store "".
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    email: EmailStr
    full_name: str | None = None
    phone: str | None = None
    avatar_url: str | None = None
    created_at: datetime


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"  # noqa: S105 — the OAuth scheme name, not a secret
    expires_in: int = Field(description="Access token lifetime in seconds.")


class AuthResponse(BaseModel):
    user: UserPublic
    tokens: TokenPair
