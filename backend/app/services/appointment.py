from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import (
    AppointmentNotFound,
    BookingTooFar,
    BookingTooSoon,
    OutsideWorkingHours,
    ServiceInactive,
    ServiceNotFound,
    SlotUnavailable,
)
from app.models.appointment import (
    Appointment,
    AppointmentSource,
    AppointmentStatus,
)
from app.models.business import Business
from app.models.service import Service
from app.models.user import User
from app.models.working_hours import WorkingHours
from app.repositories.appointment import AppointmentRepository
from app.schemas.appointment import (
    CreateAppointmentRequest,
    UpdateAppointmentRequest,
)
from app.schemas.service import SLOT_MINUTES
from app.services.business import BusinessService

# A window is a stretch of wall-clock time the business is open for, already
# converted to absolute time. Everything below reasons in these rather than in
# opening times, because a break splits a day into two and midnight joins two
# days into one — and neither is expressible as a single pair of clock times.
Window = tuple[datetime, datetime]


class AppointmentService:
    """The booking rules, with no knowledge of HTTP.

    It leans on `BusinessService` rather than re-reading the business itself:
    the lazy creation of a business and the seven-row default week are that
    service's job, and a second copy of either would be a second thing to keep
    right.
    """

    def __init__(
        self,
        session: AsyncSession,
        businesses: BusinessService,
        appointments: AppointmentRepository,
    ) -> None:
        self._session = session
        self._businesses = businesses
        self._appointments = appointments

    # --- reading ---------------------------------------------------------

    async def list_range(
        self,
        user: User,
        start_day: date | None,
        end_day: date | None,
        statuses: Sequence[str] | None = None,
        query: str | None = None,
    ) -> Sequence[Appointment]:
        """Everything overlapping a span of local days, ends included.

        The caller thinks in dates the owner would name — "с 1 по 7 марта" — and
        those are local days, so the conversion to an absolute range happens
        here, where the business's zone is known.

        A search with no dates on it deliberately drops the range entirely:
        looking for a client means looking for *their* bookings, and defaulting
        that to the next thirty days would hide every visit they ever made.
        """
        business = await self._businesses.get_or_create(user)
        tz = _zone(business)
        today = datetime.now(UTC).astimezone(tz).date()

        if query and start_day is None and end_day is None:
            return await self._appointments.list_in_range(
                business.id, None, None, statuses, query
            )

        first = start_day or today
        last = end_day or first + timedelta(days=30)
        if last < first:
            first, last = last, first

        start = _local(first, time(0, 0), tz)
        # Exclusive upper bound at the start of the day after the last one, so
        # the final day is included whole without any 23:59:59 arithmetic.
        end = _local(last + timedelta(days=1), time(0, 0), tz)
        return await self._appointments.list_in_range(
            business.id, start, end, statuses, query
        )

    async def get(self, user: User, appointment_id: uuid.UUID) -> Appointment:
        business = await self._businesses.get_or_create(user)
        appointment = await self._appointments.get_for_business(
            business.id, appointment_id
        )
        if appointment is None:
            raise AppointmentNotFound
        return appointment

    async def available_slots(
        self, user: User, service_id: uuid.UUID, day: date
    ) -> list[datetime]:
        """Every start time this service still fits into on that local day.

        The one question the assistant asks most, answered once and completely:
        opening hours, the lunch break, midnight-spanning days, bookings already
        taken, the notice the business needs and how far ahead it accepts work
        are all applied here. A caller that re-derived any of them would be a
        second implementation of the rules.
        """
        business = await self._businesses.get_or_create(user)
        service = await self._find_service(user, service_id)
        tz = _zone(business)

        now = datetime.now(UTC)
        today = now.astimezone(tz).date()
        if day < today or day > today + timedelta(days=business.booking_horizon_days):
            return []

        earliest = now + timedelta(minutes=business.min_lead_minutes)
        duration = timedelta(minutes=service.duration_minutes)
        day_start = _local(day, time(0, 0), tz)
        day_end = _local(day + timedelta(days=1), time(0, 0), tz)

        windows = await self._windows_around(user, business, day)
        if not windows:
            return []

        taken = await self._appointments.list_blocking(
            business.id, windows[0][0], windows[-1][1]
        )

        slots: list[datetime] = []
        step = timedelta(minutes=SLOT_MINUTES)
        for window_start, window_end in windows:
            cursor = window_start
            while cursor + duration <= window_end:
                if (
                    day_start <= cursor < day_end
                    and cursor >= earliest
                    and _free(taken, cursor, cursor + duration, business.capacity)
                ):
                    slots.append(cursor.astimezone(tz))
                cursor += step

        return slots

    # --- writing ---------------------------------------------------------

    async def create(
        self, user: User, data: CreateAppointmentRequest
    ) -> Appointment:
        business = await self._businesses.get_or_create(user)
        # Before anything is read: the check below and the insert that follows
        # it must not interleave with another booking for the same business.
        await self._businesses.lock(business)

        service = await self._find_service(user, data.service_id)
        starts_at = data.starts_at.astimezone(UTC)
        ends_at = starts_at + timedelta(minutes=service.duration_minutes)
        # Notice and horizon constrain *clients*, not the business. The owner
        # writing down someone who walked in twenty minutes ago is recording
        # something that already happened, and refusing it would be refusing
        # reality. `source` is what tells the two apart.
        await self._ensure_within_rules(
            user,
            business,
            starts_at,
            ends_at,
            enforce_notice=data.source is not AppointmentSource.MANUAL,
        )
        await self._ensure_room(business, starts_at, ends_at)

        appointment = Appointment(
            business_id=business.id,
            service_id=service.id,
            # Copied, not looked up later: correcting a price tomorrow must not
            # rewrite what this booking cost today.
            service_name=service.name,
            duration_minutes=service.duration_minutes,
            price=service.price,
            client_name=data.client_name,
            client_phone=data.client_phone,
            starts_at=starts_at,
            ends_at=ends_at,
            status=data.status.value,
            source=data.source.value,
            note=data.note,
        )
        self._appointments.add(appointment)
        await self._session.commit()
        await self._session.refresh(appointment)
        return appointment

    async def update(
        self, user: User, appointment_id: uuid.UUID, data: UpdateAppointmentRequest
    ) -> Appointment:
        business = await self._businesses.get_or_create(user)
        await self._businesses.lock(business)

        appointment = await self._appointments.get_for_business(
            business.id, appointment_id
        )
        if appointment is None:
            raise AppointmentNotFound

        changes = data.model_dump(exclude_unset=True)
        was_blocking = appointment.blocks_slot
        moved = False

        if "starts_at" in changes and changes["starts_at"] is not None:
            starts_at = changes["starts_at"].astimezone(UTC)
            moved = starts_at != appointment.starts_at
            appointment.starts_at = starts_at
            # The duration is the one this booking was made with, not whatever
            # the price list says today.
            appointment.ends_at = starts_at + timedelta(
                minutes=appointment.duration_minutes
            )

        for field in ("client_name", "client_phone", "note"):
            if field in changes:
                setattr(appointment, field, changes[field])

        if changes.get("status") is not None:
            appointment.status = changes["status"].value

        # Where the booking sits is only re-checked when it has actually been
        # chosen again. Marking an old booking as completed must not fail
        # because its time is long past the notice period.
        if moved:
            # Every edit here comes from the panel, so the owner is the one
            # moving it — the same reasoning as a manual booking above. When the
            # assistant gets its own way in, it will have to say so.
            await self._ensure_within_rules(
                user,
                business,
                appointment.starts_at,
                appointment.ends_at,
                enforce_notice=False,
            )

        # Room, though, is re-checked whenever this booking starts occupying
        # something it wasn't: a new time, or a cancellation being taken back.
        if appointment.blocks_slot and (moved or not was_blocking):
            await self._ensure_room(
                business,
                appointment.starts_at,
                appointment.ends_at,
                exclude_id=appointment.id,
            )

        await self._session.commit()
        await self._session.refresh(appointment)
        return appointment

    async def cancel(self, user: User, appointment_id: uuid.UUID) -> Appointment:
        """Cancelling is a status, not a delete.

        The row is what the owner looks back on to see how often bookings fall
        through, and the assistant needs to know it already spoke to this client
        about this time.
        """
        return await self.update(
            user,
            appointment_id,
            UpdateAppointmentRequest(status=AppointmentStatus.CANCELLED),
        )

    # --- rules -----------------------------------------------------------

    async def _find_service(self, user: User, service_id: uuid.UUID) -> Service:
        """The service, if this business has it and still sells it.

        The active check lives here rather than at the call sites so that asking
        for a hidden service's free times and trying to book one fail the same
        way — offering slots for something that can't be booked is the worse of
        the two failures, and it is the one that would have been missed.
        """
        for service in await self._businesses.list_services(user):
            if service.id == service_id:
                if not service.is_active:
                    raise ServiceInactive
                return service
        # Scoped to this business, so an id from another account is simply not
        # found rather than reachable.
        raise ServiceNotFound

    async def _ensure_within_rules(
        self,
        user: User,
        business: Business,
        starts_at: datetime,
        ends_at: datetime,
        enforce_notice: bool,
    ) -> None:
        """Whether this time may be booked at all.

        `enforce_notice` covers the two rules that exist to protect the business
        from clients — how much warning it needs and how far ahead it accepts
        work. Opening hours are *not* under that flag: they catch a mistyped
        date just as well for the owner as for anyone else, and unlike the other
        two there is no version of "book me while you're closed" that is the
        right thing to record.
        """
        tz = _zone(business)
        if enforce_notice:
            now = datetime.now(UTC)
            if starts_at < now + timedelta(minutes=business.min_lead_minutes):
                raise BookingTooSoon
            horizon = now.astimezone(tz).date() + timedelta(
                days=business.booking_horizon_days
            )
            if starts_at.astimezone(tz).date() > horizon:
                raise BookingTooFar

        windows = await self._windows_around(
            user, business, starts_at.astimezone(tz).date()
        )
        # The whole booking has to fall inside one stretch of open time. Two
        # windows that merely add up to enough are a booking that runs through
        # the lunch break.
        if not any(
            start <= starts_at and ends_at <= end for start, end in windows
        ):
            raise OutsideWorkingHours

    async def _ensure_room(
        self,
        business: Business,
        starts_at: datetime,
        ends_at: datetime,
        exclude_id: uuid.UUID | None = None,
    ) -> None:
        taken = [
            row
            for row in await self._appointments.list_blocking(
                business.id, starts_at, ends_at
            )
            if row.id != exclude_id
        ]
        if not _free(taken, starts_at, ends_at, business.capacity):
            raise SlotUnavailable

    async def _windows_around(
        self, user: User, business: Business, day: date
    ) -> list[Window]:
        """Open stretches covering `day`, merged across midnight.

        Three days are built rather than one so that a day running to midnight
        followed by a round-the-clock day reads as one continuous stretch — a
        booking at 23:45 should not be refused because the calendar happens to
        change date halfway through it.
        """
        rows = await self._businesses.list_working_hours(user)
        week = {row.weekday: row for row in rows}
        tz = _zone(business)

        windows: list[Window] = []
        for offset in (-1, 0, 1):
            current = day + timedelta(days=offset)
            row = week.get(current.weekday())
            if row is not None:
                windows.extend(_day_windows(row, current, tz))

        return _merge(windows)


# --- helpers -------------------------------------------------------------


def _zone(business: Business) -> ZoneInfo:
    return ZoneInfo(business.timezone)


def _local(day: date, moment: time, tz: ZoneInfo) -> datetime:
    """A wall-clock reading in the business's zone, as an absolute instant."""
    return datetime.combine(day, moment, tzinfo=tz).astimezone(UTC)


def _day_windows(row: WorkingHours, day: date, tz: ZoneInfo) -> list[Window]:
    """That weekday's open stretches, the break already cut out of them."""
    if row.is_24h:
        return [
            (
                _local(day, time(0, 0), tz),
                _local(day + timedelta(days=1), time(0, 0), tz),
            )
        ]
    if row.opens_at is None or row.closes_at is None:
        return []

    opens = _local(day, row.opens_at, tz)
    closes = _local(day, row.closes_at, tz)
    if row.break_starts_at is None or row.break_ends_at is None:
        return [(opens, closes)]

    break_start = _local(day, row.break_starts_at, tz)
    break_end = _local(day, row.break_ends_at, tz)
    return [
        window
        for window in ((opens, break_start), (break_end, closes))
        if window[0] < window[1]
    ]


def _merge(windows: list[Window]) -> list[Window]:
    """Join stretches that touch, so midnight leaves no seam."""
    merged: list[Window] = []
    for start, end in sorted(windows):
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged


def _free(
    taken: Sequence[Appointment], start: datetime, end: datetime, capacity: int
) -> bool:
    """Whether one more booking fits between `start` and `end`.

    Counting overlaps against capacity, rather than asking whether the exact
    slot is taken: a 15-minute booking at 10:00 and an hour-long one at 09:30
    collide even though neither starts where the other does.
    """
    overlapping = sum(
        1 for row in taken if row.starts_at < end and row.ends_at > start
    )
    return overlapping < capacity
