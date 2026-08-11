from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.email_change_code import EmailChangeCode


class EmailChangeRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_latest_active_for_user(
        self, user_id: uuid.UUID
    ) -> EmailChangeCode | None:
        """The one code a fresh email-change request would have left live.

        Scoped by `user_id` before any hash comparison happens, for the same
        reason as `PasswordResetRepository`: a 6-digit code has only a million
        possibilities, so a global hash lookup risks a coincidental collision.
        """
        stmt = (
            select(EmailChangeCode)
            .where(
                EmailChangeCode.user_id == user_id,
                EmailChangeCode.used_at.is_(None),
            )
            .order_by(EmailChangeCode.created_at.desc())
            .limit(1)
        )
        return await self._session.scalar(stmt)

    async def invalidate_all_for_user(self, user_id: uuid.UUID, now: datetime) -> None:
        """Burn any code an earlier request issued.

        Without this, asking to move to address B would leave the code for
        address A still usable — only the most recent request should work.
        """
        stmt = (
            update(EmailChangeCode)
            .where(
                EmailChangeCode.user_id == user_id,
                EmailChangeCode.used_at.is_(None),
            )
            .values(used_at=now)
        )
        await self._session.execute(stmt)

    def add(self, code: EmailChangeCode) -> None:
        self._session.add(code)
