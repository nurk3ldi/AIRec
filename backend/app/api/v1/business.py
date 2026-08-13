from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, File, UploadFile

from app.api.deps import BusinessServiceDep, CurrentUser
from app.schemas.business import BusinessPublic, UpdateBusinessRequest

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
