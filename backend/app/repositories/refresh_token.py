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

    async def revoke(self, token: RefreshToken, now: datetime) -> None:
        token.revoked_at = now
        await self._session.flush()

    async def list_active_for_user(
        self, user_id: uuid.UUID, now: datetime
    ) -> Sequence[RefreshToken]:
        """One row per signed-in device, newest first.

        Rotation revokes the token it replaces, so at any moment a device has
        exactly one live row — which is what makes "list the sessions" a plain
        query rather than a grouping over token families.
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
