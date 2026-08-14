from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, File, UploadFile

from app.api.deps import BusinessServiceDep, CurrentUser
from app.schemas.business import BusinessPublic, UpdateBusinessRequest
from app.schemas.service import (
    ServiceListInput,
    ServicePublic,
    WorkingHoursListInput,
    WorkingHoursPublic,
)

router = APIRouter(prefix="/business", tags=["business"])


@router.get(
    "",
    response_model=BusinessPublic,
    summary="The signed-in user's business (created empty on first access)",
)
async def get_business(
    user: CurrentUser, businesses: BusinessServiceDep
) -> BusinessPublic:
    return BusinessPublic.model_validate(await businesses.get_or_create(user))


@router.patch(
    "",
    response_model=BusinessPublic,
    summary="Partial update of the business profile",
)
async def update_business(
    payload: UpdateBusinessRequest,
    user: CurrentUser,
    businesses: BusinessServiceDep,
) -> BusinessPublic:
    return BusinessPublic.model_validate(await businesses.update(user, payload))


@router.get(
    "/services",
    response_model=list[ServicePublic],
    summary="The business's price list, in the owner's order",
)
async def list_services(
    user: CurrentUser, businesses: BusinessServiceDep
) -> list[ServicePublic]:
    rows = await businesses.list_services(user)
    return [ServicePublic.model_validate(row) for row in rows]


@router.put(
    "/services",
    response_model=list[ServicePublic],
    summary="Replace the whole price list in one transaction",
)
async def replace_services(
    payload: ServiceListInput, user: CurrentUser, businesses: BusinessServiceDep
) -> list[ServicePublic]:
    rows = await businesses.replace_services(user, payload.services)
    return [ServicePublic.model_validate(row) for row in rows]


@router.get(
    "/working-hours",
    response_model=list[WorkingHoursPublic],
    summary="The week, created with defaults on first access",
)
async def list_working_hours(
    user: CurrentUser, businesses: BusinessServiceDep
) -> list[WorkingHoursPublic]:
    rows = await businesses.list_working_hours(user)
    return [WorkingHoursPublic.model_validate(row) for row in rows]


@router.put(
    "/working-hours",
    response_model=list[WorkingHoursPublic],
    summary="Replace the week's opening hours",
)
async def replace_working_hours(
    payload: WorkingHoursListInput, user: CurrentUser, businesses: BusinessServiceDep
) -> list[WorkingHoursPublic]:
    rows = await businesses.replace_working_hours(user, payload.days)
    return [WorkingHoursPublic.model_validate(row) for row in rows]


@router.post(
    "/logo",
    response_model=BusinessPublic,
    summary="Upload a logo (already cropped square by the client)",
)
async def upload_logo(
    user: CurrentUser,
    businesses: BusinessServiceDep,
    file: Annotated[UploadFile, File()],
) -> BusinessPublic:
    updated = await businesses.set_logo(user, await file.read())
    return BusinessPublic.model_validate(updated)


@router.delete(
    "/logo",
    response_model=BusinessPublic,
    summary="Remove the current logo",
)
async def delete_logo(
    user: CurrentUser, businesses: BusinessServiceDep
) -> BusinessPublic:
    return BusinessPublic.model_validate(await businesses.clear_logo(user))
