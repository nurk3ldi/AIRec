from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.note import Note


class NoteRepository:
    """Scoped by `business_id`, like every other repository here — no route is
    then one refactor away from reading another account's notes."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_for_business(
        self,
        business_id: uuid.UUID,
        *,
        folder_id: uuid.UUID | None = None,
        archived: bool | None = False,
        trashed: bool | None = False,
        query: str | None = None,
    ) -> Sequence[Note]:
        """Newest first — the note just written is the one being looked for."""
        stmt = select(Note).where(Note.business_id == business_id)

        if folder_id is not None:
            stmt = stmt.where(Note.folder_id == folder_id)
        if archived is not None:
            stmt = stmt.where(
                Note.archived_at.is_not(None)
                if archived
                else Note.archived_at.is_(None)
            )
        if trashed is not None:
            stmt = stmt.where(
                Note.deleted_at.is_not(None)
                if trashed
                else Note.deleted_at.is_(None)
            )
        if query:
            # The body is the whole note — title included, since the title is
            # its first line — so one `ilike` covers everything there is to
            # search.
            stmt = stmt.where(Note.body.ilike(f"%{query}%"))

        return (
            await self._session.scalars(stmt.order_by(Note.updated_at.desc()))
        ).all()

    async def get(
        self, business_id: uuid.UUID, note_id: uuid.UUID
    ) -> Note | None:
        stmt = select(Note).where(
            Note.id == note_id, Note.business_id == business_id
        )
        return await self._session.scalar(stmt)

    def add(self, note: Note) -> None:
        self._session.add(note)

    async def delete(self, note: Note) -> None:
        await self._session.delete(note)
