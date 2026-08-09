from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

USERNAME_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9_.-]{2,31}$")
USERNAME_MESSAGE = "Username: only letters, numbers, underscores, dots, hyphens."

# Argon2 has no bcrypt-style truncation, but an unbounded password is a cheap
# way to burn CPU, so cap it.
Password = Annotated[str, Field(min_length=8, max_length=128)]

# Latin letters, digits, and common keyboard symbols — no whitespace, no
# non-Latin scripts. Keeps passwords copy-pasteable and free of characters
# that tend to cause encoding surprises across clients.
PASSWORD_CHARSET_PATTERN = re.compile(r"^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{}|;:,.<>?]+$")
PASSWORD_CHARSET_MESSAGE = "Password can only use letters, numbers, and symbols."  # noqa: S105


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

    @field_validator("password")
    @classmethod
    def _validate_password_charset(cls, value: str) -> str:
        # Scoped to registration only — an already-registered password is by
        # definition valid, so login never needs to re-check the charset.
        if not PASSWORD_CHARSET_PATTERN.match(value):
            raise ValueError(PASSWORD_CHARSET_MESSAGE)
        return value


class LoginRequest(BaseModel):
    """The login form accepts either an email or a username in one field."""

    identifier: Annotated[str, Field(min_length=3, max_length=320)]
    password: Password

    @field_validator("identifier")
    @classmethod
    def _normalise_identifier(cls, value: str) -> str:
        return value.strip()


class RefreshRequest(BaseModel):
    refresh_token: Annotated[str, Field(min_length=16, max_length=512)]


class UsernameAvailability(BaseModel):
    available: bool


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    email: EmailStr
    created_at: datetime


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"  # noqa: S105 — the OAuth scheme name, not a secret
    expires_in: int = Field(description="Access token lifetime in seconds.")


class AuthResponse(BaseModel):
    user: UserPublic
    tokens: TokenPair
