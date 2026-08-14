from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.service import Service
from app.models.working_hours import WorkingHours


class ServiceRepository:
    """Every method is scoped by `business_id` — as with businesses, there is
    deliberately no fetch-by-id-alone, so no route is one refactor away from
    editing another account's price list."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_for_business(
        self, business_id: uuid.UUID
    ) -> Sequence[Service]:
        stmt = (
            select(Service)
            .where(Service.business_id == business_id)
            .order_by(Service.position, Service.created_at)
        )
        return (await self._session.scalars(stmt)).all()

    async def delete_missing(
        self, business_id: uuid.UUID, keep_ids: Sequence[uuid.UUID]
    ) -> None:
        """Remove the rows the submitted list no longer contains."""
        stmt = delete(Service).where(Service.business_id == business_id)
        if keep_ids:
            stmt = stmt.where(Service.id.not_in(keep_ids))
        await self._session.execute(stmt)

    def add(self, service: Service) -> None:
        self._session.add(service)


class WorkingHoursRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_for_business(
        self, business_id: uuid.UUID
    ) -> Sequence[WorkingHours]:
        stmt = (
            select(WorkingHours)
            .where(WorkingHours.business_id == business_id)
            .order_by(WorkingHours.weekday)
        )
        return (await self._session.scalars(stmt)).all()

    def add(self, hours: WorkingHours) -> None:
        self._session.add(hours)
