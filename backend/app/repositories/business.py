from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.business import Business


class BusinessRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_for_owner(self, owner_id: uuid.UUID) -> Business | None:
        """Every read is scoped by owner. There is deliberately no `get_by_id`:
        an endpoint that can fetch a business by id alone is one refactor away
        from serving one account's data to another."""
        stmt = select(Business).where(Business.owner_id == owner_id)
        return await self._session.scalar(stmt)

    def add(self, business: Business) -> None:
        self._session.add(business)
