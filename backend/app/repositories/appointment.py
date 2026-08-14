from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import BLOCKING_STATUSES, Appointment


class AppointmentRepository:
    """Every method is scoped by `business_id`, like the other repositories
    here: there is deliberately no fetch-by-id-alone, so no route can be one
    refactor away from reading another account's calendar."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_for_business(
        self, business_id: uuid.UUID, appointment_id: uuid.UUID
    ) -> Appointment | None:
        stmt = select(Appointment).where(
            Appointment.business_id == business_id,
            Appointment.id == appointment_id,
        )
        return await self._session.scalar(stmt)

    async def list_in_range(
        self,
        business_id: uuid.UUID,
        start: datetime,
        end: datetime,
        statuses: Sequence[str] | None = None,
    ) -> Sequence[Appointment]:
        """Bookings that *overlap* the window, not merely start inside it.

        A booking that began before the window and runs into it is part of that
        window — for a calendar view because it must be drawn, and for an
        availability check because it is occupying the time being asked about.
        """
        stmt = select(Appointment).where(
            Appointment.business_id == business_id,
            Appointment.starts_at < end,
            Appointment.ends_at > start,
        )
        if statuses is not None:
            stmt = stmt.where(Appointment.status.in_(statuses))
        return (
            await self._session.scalars(stmt.order_by(Appointment.starts_at))
        ).all()

    async def list_blocking(
        self, business_id: uuid.UUID, start: datetime, end: datetime
    ) -> Sequence[Appointment]:
        """The ones that actually take up a place in that window."""
        return await self.list_in_range(business_id, start, end, BLOCKING_STATUSES)

    def add(self, appointment: Appointment) -> None:
        self._session.add(appointment)
