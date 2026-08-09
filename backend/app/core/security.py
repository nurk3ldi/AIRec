from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Final

import jwt
from anyio import to_thread
from argon2 import PasswordHasher
from argon2.exceptions import Argon2Error

from app.core.config import settings

JWT_ALGORITHM: Final = "HS256"
ACCESS_TOKEN_TYPE: Final = "access"  # noqa: S105 — a token *kind*, not a secret

_hasher = PasswordHasher()

# Verified against this when the account does not exist, so that "unknown user"
# and "wrong password" cost the same wall-clock time and cannot be told apart.
_DUMMY_HASH: Final[str] = _hasher.hash("argon2-timing-equaliser")


def _verify_sync(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except Argon2Error:
        return False


async def hash_password(password: str) -> str:
    """Hash a password with Argon2id.

    Argon2 is intentionally CPU- and memory-hard, so it runs on a worker thread;
    calling it inline would stall the event loop for every concurrent request.
    """
    return await to_thread.run_sync(_hasher.hash, password)


async def verify_password(password: str, password_hash: str | None) -> bool:
    """Check a password, spending the same time whether or not the user exists.

    Pass `None` as `password_hash` for an unknown account — the comparison still
    runs against a dummy hash and then returns False.
    """
    known = password_hash is not None
    matched = await to_thread.run_sync(
        _verify_sync, password_hash or _DUMMY_HASH, password
    )
    return known and matched


def password_needs_rehash(password_hash: str) -> bool:
    """True when the hash was made with weaker parameters than we now use."""
    try:
        return _hasher.check_needs_rehash(password_hash)
    except Argon2Error:
        return True


def create_access_token(subject: uuid.UUID) -> tuple[str, datetime]:
    """Return a signed, short-lived access token and its expiry."""
    now = datetime.now(UTC)
    expires_at = now + timedelta(minutes=settings.access_token_ttl_minutes)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "type": ACCESS_TOKEN_TYPE,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
        "jti": uuid.uuid4().hex,
    }
    token = jwt.encode(
        payload, settings.secret_key.get_secret_value(), algorithm=JWT_ALGORITHM
    )
    return token, expires_at


def decode_access_token(token: str) -> uuid.UUID:
    """Return the subject of a valid access token.

    Raises `jwt.PyJWTError` for anything malformed, expired, or of the wrong type.
    """
    payload = jwt.decode(
        token,
        settings.secret_key.get_secret_value(),
        algorithms=[JWT_ALGORITHM],
        options={"require": ["exp", "sub", "type"]},
    )
    if payload.get("type") != ACCESS_TOKEN_TYPE:
        raise jwt.InvalidTokenError("not an access token")
    try:
        return uuid.UUID(payload["sub"])
    except (TypeError, ValueError) as exc:
        raise jwt.InvalidTokenError("subject is not a user id") from exc


def generate_refresh_token() -> tuple[str, str]:
    """Return `(plaintext, digest)` for a new refresh token.

    The token is 256 bits of CSPRNG output, so a plain SHA-256 digest is enough
    at rest — there is no low-entropy secret for an attacker to brute-force, and
    a fast digest keeps the refresh path cheap.
    """
    raw = secrets.token_urlsafe(32)
    return raw, hash_refresh_token(raw)


def hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def refresh_token_expiry() -> datetime:
    return datetime.now(UTC) + timedelta(days=settings.refresh_token_ttl_days)
