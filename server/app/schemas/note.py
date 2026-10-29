from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    folder_id: uuid.UUID | None = None
    # The whole note. Its first line is the title — see `Note` — so there is
    # nothing else to send.
    body: str
    archived: bool = False
    trashed: bool = False
    created_at: datetime
    updated_at: datetime


class CreateNoteRequest(BaseModel):
    """A new note starts empty and inside whichever folder is open.

    No body: the owner presses «новая заметка» to write, and pre-filling it with
    anything means deleting that first.
    """

    folder_id: uuid.UUID | None = None


class UpdateNoteRequest(BaseModel):
    """A partial update — omitted fields are left alone.

    `folder_id` is read with `"folder_id" in changes` rather than
    `is not None`, because `null` is a value here: it means «move this out to
    «Все заметки»», which is not the same as not sending the field.
    """

    body: str | None = None
    folder_id: uuid.UUID | None = None
    archived: bool | None = None
    trashed: bool | None = None
