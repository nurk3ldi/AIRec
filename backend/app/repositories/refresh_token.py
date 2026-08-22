from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.refresh_token import RefreshToken


class RefreshTokenRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_hash(self, token_hash: str) -> RefreshToken | None:
        """Fetch a token together with its user — the refresh path always needs
        both, so this avoids a second round trip."""
        stmt = (
            select(RefreshToken)
            .where(RefreshToken.token_hash == token_hash)
            .options(joinedload(RefreshToken.user))
        )
        return await self._session.scalar(stmt)

    def add(self, token: RefreshToken) -> None:
        self._session.add(token)

    async def revoke(self, token: RefreshToken, now: datetime) -> bool:
        """Revoke a token, and say whether *this* call is the one that did it.

        The `revoked_at IS NULL` predicate is the whole point. Rotation is a
        read-then-write, and two refreshes arriving in the same millisecond with
        the same token both read it as live — so both used to mint a
        replacement, leaving one session with two live rows, identical in every
        column a person can see. That is what put the same device in «Активные
        сессии» twice, both labelled "Текущий".

        Under READ COMMITTED the second `UPDATE` blocks on the row lock until
        the first commits, then re-evaluates its `WHERE` against the new version
        and matches nothing. So exactly one caller gets `True`, and the loser
        can be told it has nothing left to rotate.
        """
        stmt = (
            update(RefreshToken)
            .where(RefreshToken.id == token.id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        result = await self._session.execute(stmt)
        won = bool(result.rowcount)
        if won:
            # Keep the in-memory row in step with what the statement just wrote;
            # the loser is about to raise, so its copy being stale costs nothing.
            token.revoked_at = now
        return won

    async def list_active_for_user(
        self, user_id: uuid.UUID, now: datetime
    ) -> Sequence[RefreshToken]:
        """One row per signed-in device, newest first.

        Rotation revokes the token it replaces, so at any moment a device has
        exactly one live row — which is what makes "list the sessions" a plain
        query rather than a grouping over token families. That invariant is
        enforced by `uq_refresh_tokens_live_family`, not merely assumed here.
        """
        stmt = (
            select(RefreshToken)
            .where(
                RefreshToken.user_id == user_id,
                RefreshToken.revoked_at.is_(None),
                RefreshToken.expires_at > now,
            )
            .order_by(RefreshToken.first_seen_at.desc())
        )
        return (await self._session.scalars(stmt)).all()

    async def get_active_by_id_for_user(
        self, token_id: uuid.UUID, user_id: uuid.UUID, now: datetime
    ) -> RefreshToken | None:
        """Scoped by `user_id` deliberately — an id from another account must
        read as "not found", never as someone else's session to revoke."""
        stmt = select(RefreshToken).where(
            RefreshToken.id == token_id,
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > now,
        )
        return await self._session.scalar(stmt)

    async def get_active_by_family_for_user(
        self, family_id: uuid.UUID, user_id: uuid.UUID, now: datetime
    ) -> RefreshToken | None:
        """The one live token of a session, found by the family the access
        token names. Rotation keeps exactly one alive per family, so this is a
        lookup and not a pick-the-newest."""
        stmt = select(RefreshToken).where(
            RefreshToken.family_id == family_id,
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > now,
        )
        return await self._session.scalar(stmt)

    async def has_live_in_family(self, family_id: uuid.UUID, now: datetime) -> bool:
        """Whether the session this token belonged to is still signed in.

        The other half of the reuse-grace test: a token revoked moments ago
        whose family still has a live successor was rotated by a concurrent
        request from the same client. One whose family is empty was ended
        deliberately — a logout, or a theft response — and anything arriving
        with it afterwards is a replay.
        """
        stmt = select(RefreshToken.id).where(
            RefreshToken.family_id == family_id,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > now,
        )
        return await self._session.scalar(stmt) is not None

    async def revoke_other_families_for_user(
        self, user_id: uuid.UUID, keep_family_id: uuid.UUID | None, now: datetime
    ) -> None:
        """Sign out every device except the one asking."""
        stmt = update(RefreshToken).where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
        )
        if keep_family_id is not None:
            stmt = stmt.where(RefreshToken.family_id != keep_family_id)
        await self._session.execute(stmt.values(revoked_at=now))

    async def revoke_all_for_user(self, user_id: uuid.UUID, now: datetime) -> None:
        """Kill every live session for a user — used on logout-everywhere and on
        refresh-token reuse, which usually means a token was stolen."""
        stmt = (
            update(RefreshToken)
            .where(
                RefreshToken.user_id == user_id,
                RefreshToken.revoked_at.is_(None),
            )
            .values(revoked_at=now)
        )
        await self._session.execute(stmt)
