from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NoteNotFound
from app.models.note import Note
from app.models.user import User
from app.repositories.note import NoteRepository
from app.schemas.note import CreateNoteRequest, UpdateNoteRequest
from app.services.business import BusinessService


class NoteService:
    """The owner's notes, with no knowledge of HTTP.

    Archived and trashed are booleans at the edge and timestamps in the table:
    a client says «put this away», not «put this away at 14:22», and the moment
    is something the server knows.
    """

    def __init__(
        self,
        session: AsyncSession,
        businesses: BusinessService,
        notes: NoteRepository,
    ) -> None:
        self._session = session
        self._businesses = businesses
        self._notes = notes

    async def list(
        self,
        user: User,
        *,
        folder_id: uuid.UUID | None = None,
        archived: bool | None = False,
        trashed: bool | None = False,
        query: str | None = None,
    ) -> Sequence[Note]:
        business = await self._businesses.get_or_create(user)
        return await self._notes.list_for_business(
            business.id,
            folder_id=folder_id,
            archived=archived,
            trashed=trashed,
            query=query,
        )

    async def create(self, user: User, data: CreateNoteRequest) -> Note:
        business = await self._businesses.get_or_create(user)
        note = Note(business_id=business.id, folder_id=data.folder_id, body="")
        self._notes.add(note)
        await self._session.commit()
        await self._session.refresh(note)
        return note

    async def update(
        self, user: User, note_id: uuid.UUID, data: UpdateNoteRequest
    ) -> Note:
        note = await self._require(user, note_id)
        changes = data.model_dump(exclude_unset=True)

        if changes.get("body") is not None:
            note.body = changes["body"]
        # `in`, not `is not None`: `null` moves the note out to «Все заметки».
        if "folder_id" in changes:
            note.folder_id = changes["folder_id"]
        if changes.get("archived") is not None:
            note.archived_at = _stamp(changes["archived"])
        if changes.get("trashed") is not None:
            note.deleted_at = _stamp(changes["trashed"])
            # Out of the bin is back on the shelf, not back in the archive.
            if not changes["trashed"]:
                note.archived_at = None

        await self._session.commit()
        await self._session.refresh(note)
        return note

    async def delete(self, user: User, note_id: uuid.UUID) -> None:
        """Gone for good — emptying the bin, not putting something in it."""
        note = await self._require(user, note_id)
        await self._notes.delete(note)
        await self._session.commit()

    async def _require(self, user: User, note_id: uuid.UUID) -> Note:
        business = await self._businesses.get_or_create(user)
        note = await self._notes.get(business.id, note_id)
        if note is None:
            raise NoteNotFound
        return note


def _stamp(on: bool) -> datetime | None:
    return datetime.now(UTC) if on else None
