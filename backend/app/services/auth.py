from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.email import (
    send_email_change_email,
    send_password_change_email,
    send_password_reset_email,
)
from app.core.errors import (
    AccountDeleted,
    DeleteConfirmationMismatch,
    EmailAlreadyRegistered,
    EmailNotRegistered,
    InactiveAccount,
    InvalidCredentials,
    InvalidCurrentPassword,
    InvalidEmailCode,
    InvalidRefreshToken,
    InvalidResetCode,
    NoPendingEmailChange,
    SameEmail,
    SessionNotFound,
    UsernameAlreadyTaken,
)
from app.core.images import AVATAR_STORE, delete_image, save_image
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
from app.core.useragent import describe_device
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
    SessionPublic,
    TokenPair,
    UpdateProfileRequest,
)


@dataclass(frozen=True, slots=True)
class ClientInfo:
    """What the transport knows about the caller's device.

    Passed in as plain strings so the service layer still has no idea FastAPI
    exists — the route is what reads the headers.
    """

    user_agent: str | None = None
    ip_address: str | None = None


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

    async def register(
        self, data: RegisterRequest, *, client: ClientInfo | None = None
    ) -> tuple[User, TokenPair]:
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

        tokens = await self._issue_tokens(
            user,
            # Registration has no checkbox and does not need one: an account is
            # made on the machine its owner works from, and the one place this
            # would be wrong — signing up on a borrowed computer — is answered
            # by signing out, not by a control on the form.
            remember=True,
            user_agent=client.user_agent if client else None,
            ip_address=client.ip_address if client else None,
        )
        await self._session.commit()
        return user, tokens

    async def authenticate(
        self,
        identifier: str,
        password: str,
        *,
        remember: bool,
        client: ClientInfo | None = None,
    ) -> tuple[User, TokenPair]:
        user = await self._users.get_by_identifier(identifier)

        # Always run the verification, even with no user, so that a missing
        # account and a wrong password are indistinguishable by timing.
        password_ok = await verify_password(
            password, user.password_hash if user else None
        )
        if user is None or not password_ok:
            raise InvalidCredentials

        if user.deleted_at is not None:
            raise _account_deleted_error(user)
        if not user.is_active:
            raise InactiveAccount

        # Transparently upgrade hashes made with older Argon2 parameters.
        if password_needs_rehash(user.password_hash):
            user.password_hash = await hash_password(password)

        tokens = await self._issue_tokens(
            user,
            remember=remember,
            user_agent=client.user_agent if client else None,
            ip_address=client.ip_address if client else None,
        )
        await self._session.commit()
        return user, tokens

    async def delete_account(
        self, user: User, current_password: str, confirmation: str
    ) -> None:
        """Start the deletion grace period.

        The row is kept and only marked — nothing is actually removed until
        `purge_deleted_accounts` runs past the deadline, which is what makes
        `restore_account` possible.
        """
        if not await verify_password(current_password, user.password_hash):
            raise InvalidCurrentPassword
        if confirmation.strip().lower() != user.username.lower():
            raise DeleteConfirmationMismatch

        now = datetime.now(UTC)
        user.deleted_at = now
        # Signed out everywhere immediately: the account is gone as far as the
        # user is concerned, even though the row lingers.
        await self._tokens.revoke_all_for_user(user.id, now)
        await self._session.commit()

    async def restore_account(
        self,
        identifier: str,
        password: str,
        *,
        remember: bool,
        client: ClientInfo | None = None,
    ) -> tuple[User, TokenPair]:
        """Undo a deletion that hasn't been purged yet, and sign the user in."""
        user = await self._users.get_by_identifier(identifier)
        password_ok = await verify_password(
            password, user.password_hash if user else None
        )
        if user is None or not password_ok:
            raise InvalidCredentials
        if user.deleted_at is None:
            # Nothing to restore — but they did just prove who they are, so this
            # is a plain sign-in rather than an error.
            return await self.authenticate(
                identifier, password, remember=remember, client=client
            )
        if not user.is_active:
            raise InactiveAccount

        user.deleted_at = None
        tokens = await self._issue_tokens(
            user,
            remember=remember,
            user_agent=client.user_agent if client else None,
            ip_address=client.ip_address if client else None,
        )
        await self._session.commit()
        return user, tokens

    async def purge_deleted_accounts(self) -> int:
        """Remove accounts whose grace period has run out. Returns the count.

        Avatar files are deleted here rather than at soft-delete time — until
        the deadline the account can come back, and it should come back with its
        picture.
        """
        users = await self._users.list_purgeable(datetime.now(UTC))
        filenames = [u.avatar_filename for u in users]

        for user in users:
            await self._users.delete(user)
        await self._session.commit()

        # After the rows are gone, so a failed commit never orphans a file.
        for filename in filenames:
            await delete_image(AVATAR_STORE, filename)
        return len(users)

    async def refresh(self, raw_token: str) -> tuple[User, TokenPair]:
        now = datetime.now(UTC)
        stored = await self._tokens.get_by_hash(hash_refresh_token(raw_token))

        if stored is None:
            raise InvalidRefreshToken

        if stored.revoked_at is not None:
            # This token has already been rotated away. That is either the same
            # client asking twice at once, or someone replaying a stolen token,
            # and the row alone cannot tell you which — so ask two questions.
            #
            # Was it rotated moments ago, and is the session it belonged to
            # still signed in? Then a concurrent request from this same client
            # already did the rotation and holds the replacement; this call has
            # simply lost a race it never knew it was in. Refuse it and change
            # nothing.
            #
            # Otherwise the token is old, or its session is already over, and a
            # replay is the only explanation left: end every session the user
            # has, because the one thing worse than an unnecessary sign-out is
            # leaving a stolen credential working.
            age = (now - stored.revoked_at).total_seconds()
            raced = age <= settings.refresh_token_reuse_grace_seconds and (
                await self._tokens.has_live_in_family(stored.family_id, now)
            )
            if not raced:
                await self._tokens.revoke_all_for_user(stored.user_id, now)
                await self._session.commit()
            raise InvalidRefreshToken

        if stored.expires_at <= now:
            raise InvalidRefreshToken

        user = stored.user
        if user.deleted_at is not None:
            raise _account_deleted_error(user)
        if not user.is_active:
            raise InactiveAccount

        # Rotation: one refresh token is good for exactly one use. The
        # replacement inherits the session — same family, same sign-in time,
        # same device label — so refreshing doesn't look like a new login.
        if not await self._tokens.revoke(stored, now):
            # Lost a race: another request rotated this same token while we were
            # deciding. Deliberately *not* the theft response above — that one
            # is for a token we read as already revoked, meaning an old one is
            # being replayed. Here we read it live, so this is two calls sharing
            # a valid token in the same instant, the replacement already exists,
            # and there is nothing left for this call to rotate. Killing every
            # session over it would log a user out for double-clicking.
            raise InvalidRefreshToken
        tokens = await self._issue_tokens(
            user,
            # Carried, not re-decided: the answer was given once at sign-in and
            # this is the same session continuing.
            remember=stored.remember,
            family_id=stored.family_id,
            user_agent=stored.user_agent,
            ip_address=stored.ip_address,
            first_seen_at=stored.first_seen_at,
        )
        await self._session.commit()
        return user, tokens

    async def list_sessions(
        self, user: User, current_session_id: uuid.UUID | None
    ) -> list[SessionPublic]:
        rows = await self._tokens.list_active_for_user(user.id, datetime.now(UTC))
        return [
            SessionPublic(
                id=row.id,
                device=describe_device(row.user_agent),
                ip_address=row.ip_address,
                signed_in_at=row.first_seen_at,
                # This token was minted by the most recent refresh, so its
                # creation time is the closest thing to "last seen".
                last_active_at=row.created_at,
                is_current=row.family_id == current_session_id,
            )
            for row in rows
        ]

    async def revoke_session(self, user: User, session_id: uuid.UUID) -> None:
        now = datetime.now(UTC)
        stored = await self._tokens.get_active_by_id_for_user(session_id, user.id, now)
        if stored is None:
            raise SessionNotFound
        await self._tokens.revoke(stored, now)
        await self._session.commit()

    async def revoke_other_sessions(
        self, user: User, current_session_id: uuid.UUID | None
    ) -> None:
        await self._tokens.revoke_other_families_for_user(
            user.id, current_session_id, datetime.now(UTC)
        )
        await self._session.commit()

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

    async def cancel_email_change(self, user: User) -> None:
        """Abandon a pending change. Idempotent — nothing pending is not an
        error, so the client can always safely clear the banner."""
        await self._email_changes.invalidate_all_for_user(user.id, datetime.now(UTC))
        await self._session.commit()

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
        filename = await save_image(AVATAR_STORE, raw)
        previous = user.avatar_filename
        user.avatar_filename = filename
        await self._session.commit()
        # Only after the row commits, so a failed write never orphans the
        # user's existing avatar.
        await delete_image(AVATAR_STORE, previous)
        return user

    async def clear_avatar(self, user: User) -> User:
        previous = user.avatar_filename
        user.avatar_filename = None
        await self._session.commit()
        await delete_image(AVATAR_STORE, previous)
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

    async def request_password_change(self, user: User) -> None:
        """Issue a code for a signed-in user to set a new password.

        Deliberately reuses `password_reset_codes` rather than adding a third
        near-identical table: both flows authorise exactly the same thing — "set
        a new password for this user" — so the latest code winning across both
        is the behaviour you want anyway.
        """
        now = datetime.now(UTC)
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

        await send_password_change_email(user.email, raw_code)

    async def change_password(
        self,
        user: User,
        new_password: str,
        *,
        current_password: str | None = None,
        code: str | None = None,
        current_session_id: uuid.UUID | None = None,
    ) -> tuple[User, TokenPair]:
        """Apply a password change and re-issue this client's session.

        Takes either proof — the current password or a mailed code — since
        neither dominates the other: the password path survives losing access to
        the mailbox, the code path survives the password having leaked. The
        schema guarantees exactly one arrives.

        Every existing refresh token is revoked, including the caller's own —
        changing a password must not leave another device signed in. The fresh
        pair returned here is what keeps the *current* client from being kicked
        out by its own action.
        """
        record: PasswordResetCode | None = None
        if current_password is not None:
            if not await verify_password(current_password, user.password_hash):
                raise InvalidCurrentPassword
        else:
            record = await self._consume_reset_code(user, code or "")

        now = datetime.now(UTC)

        # Read before the revocation below wipes it: the replacement pair keeps
        # this client's own answer to "Запомнить меня". Re-deciding it here
        # would silently promote a session the user asked not to remember —
        # changing a password is not a place to hand out a longer credential
        # than the one being replaced. Unknown (a token minted before `sid`
        # existed) falls back to the shorter life, which fails safe.
        remember = False
        if current_session_id is not None:
            current = await self._tokens.get_active_by_family_for_user(
                current_session_id, user.id, now
            )
            if current is not None:
                remember = current.remember

        user.password_hash = await hash_password(new_password)
        if record is not None:
            record.used_at = now
        await self._tokens.revoke_all_for_user(user.id, now)

        tokens = await self._issue_tokens(user, remember=remember)
        await self._session.commit()
        return user, tokens

    async def _consume_reset_code(self, user: User, code: str) -> PasswordResetCode:
        """Validate the user's latest password code, or raise.

        Returns the record without marking it used — the caller decides that,
        since it should only burn once the new password is actually applied.
        """
        record = await self._password_resets.get_latest_active_for_user(user.id)
        now = datetime.now(UTC)

        if (
            record is None
            or record.expires_at <= now
            or record.attempts >= settings.password_reset_max_attempts
        ):
            raise InvalidResetCode

        if record.code_hash != hash_reset_code(code):
            # The counter, not the digest, is what protects a 6-digit code.
            record.attempts += 1
            await self._session.commit()
            raise InvalidResetCode

        return record

    async def reset_password(self, email: str, code: str, new_password: str) -> None:
        user = await self._users.get_by_email(email)
        if user is None:
            raise InvalidResetCode

        record = await self._consume_reset_code(user, code)
        now = datetime.now(UTC)

        user.password_hash = await hash_password(new_password)
        record.used_at = now
        # A password reset is a strong signal something was wrong — end every
        # session, the same way replayed-refresh-token theft-response does.
        await self._tokens.revoke_all_for_user(user.id, now)
        await self._session.commit()

    async def _issue_tokens(
        self,
        user: User,
        *,
        remember: bool,
        family_id: uuid.UUID | None = None,
        user_agent: str | None = None,
        ip_address: str | None = None,
        first_seen_at: datetime | None = None,
    ) -> TokenPair:
        """Mint a pair. Passing an existing `family_id` continues that session
        instead of starting a new one — that's what a refresh does, and it's why
        rotation doesn't make a device look like a new sign-in every 15 minutes.

        `remember` has no default on purpose: it decides how long the token
        lives, and every one of the five places that mint a pair has a different
        right answer. A default here would be one of them silently.
        """
        session_id = family_id or uuid.uuid4()
        access_token, _ = create_access_token(user.id, session_id)
        raw_refresh, refresh_hash = generate_refresh_token()

        self._tokens.add(
            RefreshToken(
                user_id=user.id,
                token_hash=refresh_hash,
                family_id=session_id,
                user_agent=user_agent,
                ip_address=ip_address,
                first_seen_at=first_seen_at or datetime.now(UTC),
                remember=remember,
                expires_at=refresh_token_expiry(remember=remember),
            )
        )
        await self._session.flush()

        return TokenPair(
            access_token=access_token,
            refresh_token=raw_refresh,
            expires_in=settings.access_token_ttl_minutes * 60,
        )


def _account_deleted_error(user: User) -> AccountDeleted:
    """Carries the deadline in the message — "аккаунт удалён" on its own gives
    the user no way to know they can still get it back."""
    due = user.purge_due_at
    if due is None:
        return AccountDeleted()
    return AccountDeleted(
        "Аккаунт удалён. Восстановить можно до {date}.",
        date=due.strftime("%d.%m.%Y"),
    )


def _conflict_for(exc: IntegrityError) -> Exception:
    """Map a unique-violation to the field that caused it."""
    detail = str(exc.orig)
    if "uq_users_username_lower" in detail:
        return UsernameAlreadyTaken()
    if "uq_users_email" in detail:
        return EmailAlreadyRegistered()
    return exc
