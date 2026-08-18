from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Final, NamedTuple

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


class AccessTokenClaims(NamedTuple):
    user_id: uuid.UUID
    # The refresh-token family this access token belongs to — i.e. which signed-in
    # device it came from. None for tokens issued before sessions existed.
    session_id: uuid.UUID | None


def create_access_token(
    subject: uuid.UUID, session_id: uuid.UUID
) -> tuple[str, datetime]:
    """Return a signed, short-lived access token and its expiry."""
    now = datetime.now(UTC)
    expires_at = now + timedelta(minutes=settings.access_token_ttl_minutes)
    payload: dict[str, Any] = {
        "sub": str(subject),
        # Lets `/auth/me/sessions` mark which row is the caller's own without
        # the client ever having to send its refresh token to a listing.
        "sid": str(session_id),
        "type": ACCESS_TOKEN_TYPE,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
        "jti": uuid.uuid4().hex,
    }
    token = jwt.encode(
        payload, settings.secret_key.get_secret_value(), algorithm=JWT_ALGORITHM
    )
    return token, expires_at


def decode_access_token(token: str) -> AccessTokenClaims:
    """Return the claims of a valid access token.

    Raises `jwt.PyJWTError` for anything malformed, expired, or of the wrong type.
    `sid` is not required: tokens issued before sessions existed simply have no
    session, which costs them nothing but the "this device" marker.
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
        user_id = uuid.UUID(payload["sub"])
    except (TypeError, ValueError) as exc:
        raise jwt.InvalidTokenError("subject is not a user id") from exc

    raw_session = payload.get("sid")
    try:
        session_id = uuid.UUID(raw_session) if raw_session else None
    except (TypeError, ValueError):
        session_id = None

    return AccessTokenClaims(user_id=user_id, session_id=session_id)


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


def refresh_token_expiry(*, remember: bool) -> datetime:
    """When a refresh token issued now should die.

    Sliding either way — every rotation grants a fresh window — so the shorter
    one measures inactivity, not the age of the sign-in. A tab left open all
    day never trips it; a browser closed at six has nothing left to refresh
    with, and the row is dead by morning.

    Keyword-only, and with no default, so neither lifetime can be picked by
    accident at a call site that never thought about it.
    """
    if remember:
        return datetime.now(UTC) + timedelta(days=settings.refresh_token_ttl_days)
    return datetime.now(UTC) + timedelta(
        hours=settings.refresh_token_session_ttl_hours
    )


def generate_reset_code() -> tuple[str, str]:
    """Return `(plaintext, digest)` for a new 6-digit password reset code.

    Unlike a refresh token, a 6-digit code has far too little entropy for the
    digest alone to resist guessing — `PasswordResetCode.attempts` is what
    actually protects this one (see `AuthService.reset_password`).
    """
    raw = f"{secrets.randbelow(1_000_000):06d}"
    return raw, hash_reset_code(raw)


def hash_reset_code(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def reset_code_expiry() -> datetime:
    return datetime.now(UTC) + timedelta(minutes=settings.password_reset_code_ttl_minutes)


def email_change_code_expiry() -> datetime:
    return datetime.now(UTC) + timedelta(minutes=settings.email_change_code_ttl_minutes)
