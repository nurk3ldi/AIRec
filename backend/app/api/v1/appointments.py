from __future__ import annotations

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import AppointmentServiceDep, CurrentUser
from app.models.appointment import AppointmentStatus
from app.schemas.appointment import (
    AppointmentPublic,
    CreateAppointmentRequest,
    DaySlots,
    UpdateAppointmentRequest,
)

router = APIRouter(prefix="/appointments", tags=["appointments"])


@router.get(
    "",
    response_model=list[AppointmentPublic],
    summary="Bookings overlapping a span of local days",
)
async def list_appointments(
    user: CurrentUser,
    appointments: AppointmentServiceDep,
    date_from: Annotated[
        date | None,
        Query(alias="from", description="Local day, inclusive. Defaults to today."),
    ] = None,
    date_to: Annotated[
        date | None,
        Query(alias="to", description="Local day, inclusive. Defaults to +30 days."),
    ] = None,
    status: Annotated[
        list[AppointmentStatus] | None,
        Query(description="Repeat to filter on several at once."),
    ] = None,
    query: Annotated[
        str | None,
        Query(
            max_length=64,
            description=(
                "Client name or phone. Punctuation in a number is ignored. "
                "On its own, with no from/to, it searches the whole history."
            ),
        ),
    ] = None,
) -> list[AppointmentPublic]:
    rows = await appointments.list_range(
        user,
        date_from,
        date_to,
        [item.value for item in status] if status else None,
        query,
    )
    return [AppointmentPublic.model_validate(row) for row in rows]


@router.get(
    "/slots",
    response_model=DaySlots,
    summary="Start times this service still fits into on that day",
)
async def list_slots(
    user: CurrentUser,
    appointments: AppointmentServiceDep,
    service_id: Annotated[uuid.UUID, Query()],
    day: Annotated[date, Query(description="Local day.")],
) -> DaySlots:
    slots = await appointments.available_slots(user, service_id, day)
    return DaySlots(day=day, slots=slots)


@router.post(
    "",
    response_model=AppointmentPublic,
    status_code=201,
    summary="Book a time",
)
async def create_appointment(
    payload: CreateAppointmentRequest,
    user: CurrentUser,
    appointments: AppointmentServiceDep,
) -> AppointmentPublic:
    return AppointmentPublic.model_validate(
        await appointments.create(user, payload)
    )


@router.get(
    "/{appointment_id}",
    response_model=AppointmentPublic,
    summary="One booking",
)
async def get_appointment(
    appointment_id: uuid.UUID,
    user: CurrentUser,
    appointments: AppointmentServiceDep,
) -> AppointmentPublic:
    return AppointmentPublic.model_validate(
        await appointments.get(user, appointment_id)
    )


@router.patch(
    "/{appointment_id}",
    response_model=AppointmentPublic,
    summary="Edit, reschedule or change the status of a booking",
)
async def update_appointment(
    appointment_id: uuid.UUID,
    payload: UpdateAppointmentRequest,
    user: CurrentUser,
    appointments: AppointmentServiceDep,
) -> AppointmentPublic:
    return AppointmentPublic.model_validate(
        await appointments.update(user, appointment_id, payload)
    )


@router.delete(
    "/{appointment_id}",
    response_model=AppointmentPublic,
    summary="Cancel a booking (a status, not a delete)",
)
async def cancel_appointment(
    appointment_id: uuid.UUID,
    user: CurrentUser,
    appointments: AppointmentServiceDep,
) -> AppointmentPublic:
    return AppointmentPublic.model_validate(
        await appointments.cancel(user, appointment_id)
    )
