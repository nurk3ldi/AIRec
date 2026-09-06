from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, NoteFolderServiceDep, NoteServiceDep
from app.schemas.note import (
    CreateNoteRequest,
    NotePublic,
    UpdateNoteRequest,
)
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


@router.get("", response_model=list[NotePublic], summary="Notes, newest first")
async def list_notes(
    user: CurrentUser,
    notes: NoteServiceDep,
    folder: Annotated[
        uuid.UUID | None,
        Query(description="Only this folder. Omit for every note."),
    ] = None,
    archived: Annotated[
        bool | None, Query(description="Default false. Null includes both.")
    ] = False,
    trashed: Annotated[
        bool | None, Query(description="Default false. Null includes both.")
    ] = False,
    query: Annotated[
        str | None,
        Query(max_length=200, description="Anything written in the note."),
    ] = None,
):
    return await notes.list(
        user,
        folder_id=folder,
        archived=archived,
        trashed=trashed,
        query=query,
    )


@router.post(
    "",
    response_model=NotePublic,
    status_code=status.HTTP_201_CREATED,
    summary="Start a note",
)
async def create_note(
    payload: CreateNoteRequest,
    user: CurrentUser,
    notes: NoteServiceDep,
):
    """Empty, and in whichever folder is open. The owner pressed this to write;
    anything pre-filled would be something to delete first."""
    return await notes.create(user, payload)


@router.patch(
    "/{note_id}", response_model=NotePublic, summary="Write into it, or move it"
)
async def update_note(
    note_id: uuid.UUID,
    payload: UpdateNoteRequest,
    user: CurrentUser,
    notes: NoteServiceDep,
):
    return await notes.update(user, note_id, payload)


@router.delete(
    "/{note_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Empty it out of the bin",
)
async def delete_note(
    note_id: uuid.UUID, user: CurrentUser, notes: NoteServiceDep
):
    await notes.delete(user, note_id)
