from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NoteFolderNotFound
from app.models.note_folder import NoteFolder
from app.models.user import User
from app.repositories.note_folder import NoteFolderRepository
from app.schemas.note_folder import (
    CreateNoteFolderRequest,
    UpdateNoteFolderRequest,
)
from app.services.business import BusinessService


class NoteFolderService:
    """The owner's own folders, with no knowledge of HTTP.

    **Archived and trashed are booleans at the edge and timestamps in the
    table.** A client says «put this away», not «put this away at 14:22»; the
    moment is something the server knows and the caller would otherwise have to
    invent. `_stamp` is the one place that translation happens.
    """

    def __init__(
        self,
        session: AsyncSession,
        businesses: BusinessService,
        folders: NoteFolderRepository,
    ) -> None:
        self._session = session
        self._businesses = businesses
        self._folders = folders

    async def list(self, user: User) -> Sequence[NoteFolder]:
        business = await self._businesses.get_or_create(user)
        return await self._folders.list_for_business(business.id)

    async def create(
        self, user: User, data: CreateNoteFolderRequest
    ) -> NoteFolder:
        business = await self._businesses.get_or_create(user)
        folder = NoteFolder(
            business_id=business.id,
            name=data.name,
            position=await self._folders.next_position(business.id),
        )
        self._folders.add(folder)
        await self._session.commit()
        await self._session.refresh(folder)
        return folder

    async def update(
        self, user: User, folder_id: uuid.UUID, data: UpdateNoteFolderRequest
    ) -> NoteFolder:
        folder = await self._require(user, folder_id)
        changes = data.model_dump(exclude_unset=True)

        if "name" in changes and changes["name"] is not None:
            folder.name = changes["name"]
        if "archived" in changes and changes["archived"] is not None:
            folder.archived_at = _stamp(changes["archived"])
        if "trashed" in changes and changes["trashed"] is not None:
            folder.deleted_at = _stamp(changes["trashed"])
            # Out of the bin is back on the shelf, not back in the archive: a
            # folder restored from the trash should appear where the owner
            # looks for it, and they look in the list.
            if not changes["trashed"]:
                folder.archived_at = None

        await self._session.commit()
        await self._session.refresh(folder)
        return folder

    async def delete(self, user: User, folder_id: uuid.UUID) -> None:
        """Gone for good — emptying the bin, not putting something in it."""
        folder = await self._require(user, folder_id)
        await self._folders.delete(folder)
        await self._session.commit()

    async def _require(self, user: User, folder_id: uuid.UUID) -> NoteFolder:
        business = await self._businesses.get_or_create(user)
        folder = await self._folders.get(business.id, folder_id)
        if folder is None:
            raise NoteFolderNotFound
        return folder


def _stamp(on: bool) -> datetime | None:
    return datetime.now(UTC) if on else None
