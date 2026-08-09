from __future__ import annotations

import uuid
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
