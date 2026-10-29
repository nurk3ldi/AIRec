from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.business import Business


class NoteFolder(Base):
    """A folder the owner made for their own notes.

    **Belongs to the business, not the user**, like everything else the owner
    keeps — a business will eventually have more than one person attached, and a
    folder made by one of them is the salon's, not theirs.

    **«Все заметки», «Архив» and «Корзина» are not rows here.** Those three are
    states a note can be in, not folders anybody made, so they live in the
    frontend as a constant. Storing them would mean every account starts with
    three rows nobody can rename or delete, and the first code path that forgot
    to exclude them would offer to.

    **Archived and trashed are two timestamps, not a status column.** Same shape
    as `conversations.archived_at` and `appointments.archived_at`, and for the
    same reason: NULL is the only value that can mean "never was", and "when did
    this go into the bin" is free from a column that had to exist anyway.

    Trash is a *state*, not a delete — the folder can come back out of it. A row
    is removed for good only by `DELETE`, which is the separate act of emptying
    the bin.
    """

    __tablename__ = "note_folders"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    # The owner's chosen order. Without it the list would reshuffle on every
    # read, and a sidebar people navigate by has a deliberate order.
    position: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )

    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    business: Mapped[Business] = relationship()

    @property
    def archived(self) -> bool:
        return self.archived_at is not None

    @property
    def trashed(self) -> bool:
        return self.deleted_at is not None

    def __repr__(self) -> str:
        return f"<NoteFolder {self.name}>"
