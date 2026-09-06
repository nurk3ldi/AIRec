from __future__ import annotations

import uuid

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, NoteFolderServiceDep
from app.schemas.note_folder import (
    CreateNoteFolderRequest,
    NoteFolderPublic,
    UpdateNoteFolderRequest,
)

router = APIRouter(prefix="/notes", tags=["notes"])


@router.get(
    "/folders",
    response_model=list[NoteFolderPublic],
    summary="The owner's own folders",
)
async def list_folders(user: CurrentUser, folders: NoteFolderServiceDep):
    """Everything, archived and binned included.

    The sidebar draws all three states from one list, so filtering here would
    mean three round trips for one column.
    """
    return await folders.list(user)


@router.post(
    "/folders",
    response_model=NoteFolderPublic,
    status_code=status.HTTP_201_CREATED,
    summary="Make a folder",
)
async def create_folder(
    payload: CreateNoteFolderRequest,
    user: CurrentUser,
    folders: NoteFolderServiceDep,
):
    return await folders.create(user, payload)


@router.patch(
    "/folders/{folder_id}",
    response_model=NoteFolderPublic,
    summary="Rename it, or put it away",
)
async def update_folder(
    folder_id: uuid.UUID,
    payload: UpdateNoteFolderRequest,
    user: CurrentUser,
    folders: NoteFolderServiceDep,
):
    return await folders.update(user, folder_id, payload)


@router.delete(
    "/folders/{folder_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Empty it out of the bin",
)
async def delete_folder(
    folder_id: uuid.UUID,
    user: CurrentUser,
    folders: NoteFolderServiceDep,
):
    """Removes the row. Putting a folder *into* the bin is a PATCH with
    `{"trashed": true}` — this is the act that follows it."""
    await folders.delete(user, folder_id)
