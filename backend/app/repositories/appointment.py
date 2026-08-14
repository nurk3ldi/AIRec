from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

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
        start: datetime | None,
        end: datetime | None,
        statuses: Sequence[str] | None = None,
        query: str | None = None,
    ) -> Sequence[Appointment]:
        """Bookings that *overlap* the window, not merely start inside it.

        A booking that began before the window and runs into it is part of that
        window — for a calendar view because it must be drawn, and for an
        availability check because it is occupying the time being asked about.

        `start`/`end` are optional so a search can run across the whole history;
        every other caller passes both.
        """
        stmt = select(Appointment).where(Appointment.business_id == business_id)
        if end is not None:
            stmt = stmt.where(Appointment.starts_at < end)
        if start is not None:
            stmt = stmt.where(Appointment.ends_at > start)
        if statuses is not None:
            stmt = stmt.where(Appointment.status.in_(statuses))
        if query:
            stmt = stmt.where(_matches_client(query))
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


def _matches_client(query: str) -> ColumnElement[bool]:
    """Name or phone, however the phone happens to be punctuated.

    A number is stored the way it was typed — "+7 701 000 00 00" — and nobody
    searching for a client retypes the spaces. Both sides are reduced to digits
    before comparing, so any of "7701", "701 000" or "+77010000000" finds it.
    A query with no digits in it never touches the phone column at all.
    """
    text = f"%{query.strip().lower()}%"
    conditions = [func.lower(Appointment.client_name).like(text)]

    digits = "".join(character for character in query if character.isdigit())
    if digits:
        bare_phone = func.regexp_replace(Appointment.client_phone, r"\D", "", "g")
        conditions.append(bare_phone.like(f"%{digits}%"))

    return or_(*conditions)
