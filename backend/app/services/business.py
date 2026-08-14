from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import time

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.images import LOGO_STORE, delete_image, save_image
from app.models.business import Business
from app.models.service import Service
from app.models.user import User
from app.models.working_hours import WorkingHours
from app.repositories.business import BusinessRepository
from app.repositories.service import ServiceRepository, WorkingHoursRepository
from app.schemas.business import UpdateBusinessRequest
from app.schemas.service import ServiceInput, WorkingHoursInput


class BusinessService:
    """The business behind one account, with no knowledge of HTTP."""

    def __init__(
        self,
        session: AsyncSession,
        businesses: BusinessRepository,
        services: ServiceRepository,
        working_hours: WorkingHoursRepository,
    ) -> None:
        self._session = session
        self._businesses = businesses
        self._services = services
        self._working_hours = working_hours

    async def get_or_create(self, user: User) -> Business:
        """The account's business, created empty on first access.

        Created lazily rather than at registration: signing up shouldn't decide
        anything about the company, and this way an account that never opens the
        page carries no half-filled row. Callers can always assume a business
        exists, which keeps every other endpoint free of a "not set up yet" branch.
        """
        business = await self._businesses.get_for_owner(user.id)
        if business is not None:
            return business

        business = Business(owner_id=user.id)
        self._businesses.add(business)
        await self._session.commit()
        return business

    async def lock(self, business: Business) -> None:
        """Serialise the rest of this transaction against other writers for the
        same business. Booking needs it — see `BusinessRepository.lock`."""
        await self._businesses.lock(business.id)

    async def update(self, user: User, data: UpdateBusinessRequest) -> Business:
        business = await self.get_or_create(user)

        # `exclude_unset` is what separates "field omitted" from "field set to
        # null" — only keys the client actually sent are touched.
        for field, value in data.model_dump(exclude_unset=True).items():
            if field == "timezone" and value is None:
                continue
            setattr(business, field, value)

        await self._session.commit()
        return business

    async def set_logo(self, user: User, raw: bytes) -> Business:
        business = await self.get_or_create(user)
        filename = await save_image(LOGO_STORE, raw)
        previous = business.logo_filename
        business.logo_filename = filename
        await self._session.commit()
        # Only after the row commits, so a failed write never orphans the
        # business's existing logo.
        await delete_image(LOGO_STORE, previous)
        return business

    async def list_services(self, user: User) -> Sequence[Service]:
        business = await self.get_or_create(user)
        return await self._services.list_for_business(business.id)

    async def replace_services(
        self, user: User, submitted: list[ServiceInput]
    ) -> Sequence[Service]:
        """Apply a whole price list in one transaction.

        Rows arriving with an id are updated in place, rows without one are
        created, and anything the list no longer mentions is deleted. Matching
        on id rather than rebuilding the table is what keeps a service's
        identity — and, later, its bookings — across an edit.

        An unknown or foreign id is treated as new rather than as an error: the
        lookup is scoped to this business, so a stale id from another account
        can never address a row it doesn't own.
        """
        business = await self.get_or_create(user)
        existing = {
            service.id: service
            for service in await self._services.list_for_business(business.id)
        }

        kept: list[uuid.UUID] = []
        for position, item in enumerate(submitted):
            service = existing.get(item.id) if item.id else None
            if service is None:
                service = Service(business_id=business.id)
                self._services.add(service)
            else:
                kept.append(service.id)

            service.name = item.name
            service.duration_minutes = item.duration_minutes
            service.price = item.price
            service.is_active = item.is_active
            service.position = position

        await self._services.delete_missing(business.id, kept)
        await self._session.commit()
        return await self._services.list_for_business(business.id)

    async def list_working_hours(self, user: User) -> Sequence[WorkingHours]:
        """The week, created on first read so the client always gets seven rows.

        The defaults are a guess and are meant to be corrected — but a schedule
        of seven closed days would mean an assistant that can never book, which
        is a worse starting point than a plausible one.
        """
        business = await self.get_or_create(user)
        rows = await self._working_hours.list_for_business(business.id)
        if rows:
            return rows

        for weekday in range(7):
            closed = weekday == 6
            self._working_hours.add(
                WorkingHours(
                    business_id=business.id,
                    weekday=weekday,
                    opens_at=None if closed else time(10, 0),
                    closes_at=None if closed else time(20, 0),
                )
            )
        await self._session.commit()
        return await self._working_hours.list_for_business(business.id)

    async def replace_working_hours(
        self, user: User, submitted: list[WorkingHoursInput]
    ) -> Sequence[WorkingHours]:
        # Ensures the seven rows exist before any of them is updated.
        await self.list_working_hours(user)
        business = await self.get_or_create(user)
        rows = {
            row.weekday: row
            for row in await self._working_hours.list_for_business(business.id)
        }

        for item in submitted:
            row = rows.get(item.weekday)
            if row is None:
                continue
            # A round-the-clock day owns no times at all: opening and closing
            # would have nothing to say, and a break can't interrupt a day that
            # never closes. Clearing them here means the flag can never be read
            # alongside hours that contradict it.
            row.is_24h = item.is_24h
            row.opens_at = None if item.is_24h else item.opens_at
            row.closes_at = None if item.is_24h else item.closes_at
            # A break only means anything inside a working day; carrying one on
            # a closed day would resurface the moment the day is reopened.
            open_day = row.opens_at is not None and row.closes_at is not None
            row.break_starts_at = item.break_starts_at if open_day else None
            row.break_ends_at = item.break_ends_at if open_day else None

        await self._session.commit()
        return await self._working_hours.list_for_business(business.id)

    async def clear_logo(self, user: User) -> Business:
        business = await self.get_or_create(user)
        previous = business.logo_filename
        business.logo_filename = None
        await self._session.commit()
        await delete_image(LOGO_STORE, previous)
        return business
