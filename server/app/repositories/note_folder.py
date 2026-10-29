from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.note_folder import NoteFolder


class NoteFolderRepository:
    """Every method is scoped by `business_id`.

    As with services and appointments, there is deliberately no
    fetch-by-id-alone: no route is then one refactor away from renaming another
    account's folder.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_for_business(
        self, business_id: uuid.UUID
    ) -> Sequence[NoteFolder]:
        """Everything, including archived and binned rows.

        The three states are drawn from the same list on screen, so filtering
        here would mean three round trips for one sidebar.
        """
        stmt = (
            select(NoteFolder)
            .where(NoteFolder.business_id == business_id)
            .order_by(NoteFolder.position, NoteFolder.created_at)
        )
        return (await self._session.scalars(stmt)).all()

    async def get(
        self, business_id: uuid.UUID, folder_id: uuid.UUID
    ) -> NoteFolder | None:
        stmt = select(NoteFolder).where(
            NoteFolder.id == folder_id,
            NoteFolder.business_id == business_id,
        )
        return await self._session.scalar(stmt)

    async def next_position(self, business_id: uuid.UUID) -> int:
        """Where a new folder goes: after the last one.

        Read rather than counted, because a deleted row leaves a gap and
        counting would hand the new folder a position somebody already has.
        """
        stmt = (
            select(NoteFolder.position)
            .where(NoteFolder.business_id == business_id)
            .order_by(NoteFolder.position.desc())
            .limit(1)
        )
        last = await self._session.scalar(stmt)
        return 0 if last is None else last + 1

    def add(self, folder: NoteFolder) -> None:
        self._session.add(folder)

    async def delete(self, folder: NoteFolder) -> None:
        await self._session.delete(folder)
