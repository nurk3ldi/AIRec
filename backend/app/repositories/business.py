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

    async def lock(self, business_id: uuid.UUID) -> None:
        """Take a row lock on the business for the rest of the transaction.

        Booking is read-then-write: count what occupies a time, then insert if
        there is room. Two requests for the last place would both read "room for
        one" and both insert. Serialising on the business row is the smallest
        thing that makes that impossible, and it costs nothing while bookings
        for one business arrive seconds apart rather than microseconds.
        """
        stmt = select(Business.id).where(Business.id == business_id).with_for_update()
        await self._session.execute(stmt)

    def add(self, business: Business) -> None:
        self._session.add(business)
