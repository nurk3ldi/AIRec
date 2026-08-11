from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.avatar import delete_avatar, save_avatar
from app.core.config import settings
from app.core.email import send_email_change_email, send_password_reset_email
from app.core.errors import (
    EmailAlreadyRegistered,
    EmailNotRegistered,
    InactiveAccount,
    InvalidCredentials,
    InvalidEmailCode,
    InvalidRefreshToken,
    InvalidResetCode,
    NoPendingEmailChange,
    SameEmail,
    UsernameAlreadyTaken,
)
from app.core.security import (
    create_access_token,
    email_change_code_expiry,
    generate_refresh_token,
    generate_reset_code,
    hash_password,
    hash_refresh_token,
    hash_reset_code,
    password_needs_rehash,
    refresh_token_expiry,
    reset_code_expiry,
    verify_password,
)
from app.models.email_change_code import EmailChangeCode
from app.models.password_reset_code import PasswordResetCode
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.repositories.email_change import EmailChangeRepository
from app.repositories.password_reset import PasswordResetRepository
from app.repositories.refresh_token import RefreshTokenRepository
from app.repositories.user import UserRepository
from app.schemas.auth import (
    USERNAME_PATTERN,
    RegisterRequest,
    TokenPair,
    UpdateProfileRequest,
)


class AuthService:
    """All authentication behaviour, with no knowledge of HTTP.

    Failures are raised as `AppError` subclasses; `app.main` turns those into
    responses.
    """

    def __init__(
        self,
        session: AsyncSession,
        users: UserRepository,
        tokens: RefreshTokenRepository,
        password_resets: PasswordResetRepository,
        email_changes: EmailChangeRepository,
    ) -> None:
        self._session = session
        self._users = users
        self._tokens = tokens
        self._password_resets = password_resets
        self._email_changes = email_changes

    async def register(self, data: RegisterRequest) -> tuple[User, TokenPair]:
        # Checked up front so the client gets a precise message; the unique
        # indexes below are what actually guarantee it under concurrency.
        if await self._users.email_exists(data.email):
            raise EmailAlreadyRegistered
        if await self._users.username_exists(data.username):
            raise UsernameAlreadyTaken

        user = User(
            email=data.email,
            username=data.username,
            password_hash=await hash_password(data.password),
        )
        self._users.add(user)

        try:
            await self._session.flush()
        except IntegrityError as exc:
            # Two requests raced past the checks above and the database caught it.
            await self._session.rollback()
            raise _conflict_for(exc) from exc

        tokens = await self._issue_tokens(user)
        await self._session.commit()
        return user, tokens

    async def authenticate(
        self, identifier: str, password: str
    ) -> tuple[User, TokenPair]:
        user = await self._users.get_by_identifier(identifier)

        # Always run the verification, even with no user, so that a missing
        # account and a wrong password are indistinguishable by timing.
        password_ok = await verify_password(
            password, user.password_hash if user else None
        )
        if user is None or not password_ok:
            raise InvalidCredentials

        if not user.is_active:
            raise InactiveAccount

        # Transparently upgrade hashes made with older Argon2 parameters.
        if password_needs_rehash(user.password_hash):
            user.password_hash = await hash_password(password)

        tokens = await self._issue_tokens(user)
        await self._session.commit()
        return user, tokens

    async def refresh(self, raw_token: str) -> tuple[User, TokenPair]:
        now = datetime.now(UTC)
        stored = await self._tokens.get_by_hash(hash_refresh_token(raw_token))

        if stored is None:
            raise InvalidRefreshToken

        if stored.revoked_at is not None:
            # This token was already rotated away, so whoever just sent it is
            # replaying an old one. Treat it as theft and end every session.
            await self._tokens.revoke_all_for_user(stored.user_id, now)
            await self._session.commit()
            raise InvalidRefreshToken

        if stored.expires_at <= now:
            raise InvalidRefreshToken

        user = stored.user
        if not user.is_active:
            raise InactiveAccount

        # Rotation: one refresh token is good for exactly one use.
        await self._tokens.revoke(stored, now)
        tokens = await self._issue_tokens(user)
        await self._session.commit()
        return user, tokens

    async def check_username_available(self, username: str) -> bool:
        # A malformed username could never be registered, so it can never be
        # "available" either — this keeps the live-check honest instead of
        # green-lighting something the client couldn't actually submit.
        if not USERNAME_PATTERN.match(username):
            return False
        return not await self._users.username_exists(username)

    async def update_profile(self, user: User, data: UpdateProfileRequest) -> User:
        """Apply a partial profile update.

        `exclude_unset` is what separates "field omitted" from "field set to
        null" — only keys the client actually sent are touched.
        """
        changes = data.model_dump(exclude_unset=True)

        new_username = changes.get("username")
        if new_username:
            # Case-only edits ("aruzhan" → "Aruzhan") are the user's own row,
            # so they must not trip the uniqueness check.
            is_different = new_username.lower() != user.username.lower()
            if is_different and await self._users.username_exists(new_username):
                raise UsernameAlreadyTaken
            user.username = new_username

        if "first_name" in changes:
            user.first_name = changes["first_name"]
        if "last_name" in changes:
            user.last_name = changes["last_name"]
        if "phone" in changes:
            user.phone = changes["phone"]

        try:
            await self._session.flush()
        except IntegrityError as exc:
            await self._session.rollback()
            raise _conflict_for(exc) from exc

        await self._session.commit()
        return user

    async def request_email_change(self, user: User, new_email: str) -> None:
        """Email a confirmation code to the address the user wants to move to.

        The code goes to the *new* address, never the current one — receiving
        it is the proof of ownership, which is the entire point of the flow.
        Nothing on `users` changes here.
        """
        # Sending to the address the account already has is not a no-op when
        # that address was never verified — it's how an existing account proves
        # the email it registered with. Only a already-verified address has
        # nothing to gain from it.
        is_same = new_email == user.email
        if is_same and user.email_verified:
            raise SameEmail
        if not is_same and await self._users.email_exists(new_email):
            raise EmailAlreadyRegistered

        now = datetime.now(UTC)
        # An earlier request (possibly for a different address) must not stay
        # confirmable alongside this one.
        await self._email_changes.invalidate_all_for_user(user.id, now)

        raw_code, code_hash = generate_reset_code()
        self._email_changes.add(
            EmailChangeCode(
                user_id=user.id,
                new_email=new_email,
                code_hash=code_hash,
                expires_at=email_change_code_expiry(),
            )
        )
        await self._session.commit()

        await send_email_change_email(new_email, raw_code)

    async def get_pending_email_change(self, user: User) -> str | None:
        """The address awaiting confirmation, or None.

        Anything the user could no longer confirm — expired, or out of
        attempts — reports as None, so the client never offers a "confirm"
        action that cannot succeed.
        """
        record = await self._email_changes.get_latest_active_for_user(user.id)
        if record is None:
            return None
        if (
            record.expires_at <= datetime.now(UTC)
            or record.attempts >= settings.email_change_max_attempts
        ):
            return None
        return record.new_email

    async def confirm_email_change(self, user: User, code: str) -> User:
        record = await self._email_changes.get_latest_active_for_user(user.id)
        if record is None:
            raise NoPendingEmailChange

        now = datetime.now(UTC)
        if (
            record.expires_at <= now
            or record.attempts >= settings.email_change_max_attempts
        ):
            raise InvalidEmailCode

        if record.code_hash != hash_reset_code(code):
            # The counter, not the digest, is what protects a 6-digit code.
            record.attempts += 1
            await self._session.commit()
            raise InvalidEmailCode

        # Re-checked at confirmation time, not just at request time: the address
        # may have been registered by somebody else while the code sat unused.
        # Skipped when it's the account's own address — that's a verification of
        # what it already has, and `email_exists` would match its own row.
        if record.new_email != user.email and await self._users.email_exists(
            record.new_email
        ):
            record.used_at = now
            await self._session.commit()
            raise EmailAlreadyRegistered

        user.email = record.new_email
        # Confirming the code is exactly what "verified" means here.
        user.email_verified_at = now
        record.used_at = now

        try:
            await self._session.flush()
        except IntegrityError as exc:
            await self._session.rollback()
            raise _conflict_for(exc) from exc

        await self._session.commit()
        return user

    async def set_avatar(self, user: User, raw: bytes) -> User:
        filename = await save_avatar(raw)
        previous = user.avatar_filename
        user.avatar_filename = filename
        await self._session.commit()
        # Only after the row commits, so a failed write never orphans the
        # user's existing avatar.
        await delete_avatar(previous)
        return user

    async def clear_avatar(self, user: User) -> User:
        previous = user.avatar_filename
        user.avatar_filename = None
        await self._session.commit()
        await delete_avatar(previous)
        return user

    async def logout(self, raw_token: str) -> None:
        """Revoke a single session. Idempotent — an unknown or already-revoked
        token is not an error, so a client can always safely log out."""
        stored = await self._tokens.get_by_hash(hash_refresh_token(raw_token))
        if stored is not None and stored.revoked_at is None:
            await self._tokens.revoke(stored, datetime.now(UTC))
            await self._session.commit()

    async def forgot_password(self, email: str) -> None:
        """Issue a reset code by email.

        Unlike login, this deliberately reveals whether the email is
        registered — raises `EmailNotRegistered` rather than pretending to
        succeed — trading the enumeration risk for a clearer error message.
        """
        user = await self._users.get_by_email(email)
        if user is None:
            raise EmailNotRegistered

        now = datetime.now(UTC)
        # A stale code from an earlier request must not stay usable alongside
        # the new one — only the most recently issued code should ever work.
        await self._password_resets.invalidate_all_for_user(user.id, now)

        raw_code, code_hash = generate_reset_code()
        self._password_resets.add(
            PasswordResetCode(
                user_id=user.id,
                code_hash=code_hash,
                expires_at=reset_code_expiry(),
            )
        )
        await self._session.commit()

        await send_password_reset_email(user.email, raw_code)

    async def reset_password(self, email: str, code: str, new_password: str) -> None:
        user = await self._users.get_by_email(email)
        if user is None:
            raise InvalidResetCode

        record = await self._password_resets.get_latest_active_for_user(user.id)
        now = datetime.now(UTC)

        if (
            record is None
            or record.expires_at <= now
            or record.attempts >= settings.password_reset_max_attempts
        ):
            raise InvalidResetCode

        if record.code_hash != hash_reset_code(code):
            record.attempts += 1
            await self._session.commit()
            raise InvalidResetCode

        user.password_hash = await hash_password(new_password)
        record.used_at = now
        # A password reset is a strong signal something was wrong — end every
        # session, the same way replayed-refresh-token theft-response does.
        await self._tokens.revoke_all_for_user(user.id, now)
        await self._session.commit()

    async def _issue_tokens(self, user: User) -> TokenPair:
        access_token, _ = create_access_token(user.id)
        raw_refresh, refresh_hash = generate_refresh_token()

        self._tokens.add(
            RefreshToken(
                user_id=user.id,
                token_hash=refresh_hash,
                expires_at=refresh_token_expiry(),
            )
        )
        await self._session.flush()

        return TokenPair(
            access_token=access_token,
            refresh_token=raw_refresh,
            expires_in=settings.access_token_ttl_minutes * 60,
        )


def _conflict_for(exc: IntegrityError) -> Exception:
    """Map a unique-violation to the field that caused it."""
    detail = str(exc.orig)
    if "uq_users_username_lower" in detail:
        return UsernameAlreadyTaken()
    if "uq_users_email" in detail:
        return EmailAlreadyRegistered()
    return exc
