from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class NoteFolderPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    position: int
    # Computed on the model from the two timestamps — see `NoteFolder`.
    archived: bool = False
    trashed: bool = False
    created_at: datetime
    updated_at: datetime


def _clean_name(value: str) -> str:
    name = value.strip()
    if not name:
        raise ValueError("Название папки не может быть пустым.")
    return name


class CreateNoteFolderRequest(BaseModel):
    name: str = Field(max_length=120)

    _name = field_validator("name")(_clean_name)


class UpdateNoteFolderRequest(BaseModel):
    """A partial update.

    Every field is optional and the service reads it with
    `model_dump(exclude_unset=True)` — that is what separates *"field omitted →
    leave it alone"* from *"field sent → change it"*. `archived` and `trashed`
    are booleans here and timestamps in the table; the service does the
    translation, so a client never has to invent a date to put a folder away.
    """

    name: str | None = Field(default=None, max_length=120)
    archived: bool | None = None
    trashed: bool | None = None

    _name = field_validator("name")(
        lambda value: value if value is None else _clean_name(value)
    )
