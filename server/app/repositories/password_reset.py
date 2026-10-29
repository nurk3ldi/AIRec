from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.password_reset_code import PasswordResetCode


class PasswordResetRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_latest_active_for_user(
        self, user_id: uuid.UUID
    ) -> PasswordResetCode | None:
        """The one code a fresh `/forgot-password` call would have left live.

        Scoped by `user_id` before any hash comparison happens — with only a
        million possible 6-digit codes, comparing hashes across *all* users
        risks a coincidental collision; comparing within one user's own latest
        code does not.
        """
        stmt = (
            select(PasswordResetCode)
            .where(
                PasswordResetCode.user_id == user_id,
                PasswordResetCode.used_at.is_(None),
            )
            .order_by(PasswordResetCode.created_at.desc())
            .limit(1)
        )
        return await self._session.scalar(stmt)

    async def invalidate_all_for_user(self, user_id: uuid.UUID, now: datetime) -> None:
        """Burn any code a previous `/forgot-password` call issued.

        Otherwise an old, still-unexpired code would stay valid alongside the
        new one — only the most recently issued code should ever work.
        """
        stmt = (
            update(PasswordResetCode)
            .where(
                PasswordResetCode.user_id == user_id,
                PasswordResetCode.used_at.is_(None),
            )
            .values(used_at=now)
        )
        await self._session.execute(stmt)

    def add(self, code: PasswordResetCode) -> None:
        self._session.add(code)
