from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.business import Business
    from app.models.note_folder import NoteFolder


class Note(Base):
    """One note the owner wrote for themselves.

    **One `body`, and no separate title.** The title is the first line of the
    text, derived when the note is drawn. A stored title would be a second copy
    of something the body already contains: the two drift the moment somebody
    edits the first line, and then the list and the note disagree about what the
    note is called. Apple's Notes made the same choice, and the list on screen
    reads the same way — first line in bold, the rest as the preview.

    **`folder_id` is nullable and `ON DELETE SET NULL`.** A note outside any
    folder is the ordinary case — that is what «Все заметки» holds — and a
    folder thrown away must not take the notes in it with it.

    **Archived and trashed are two timestamps**, the same shape as
    `note_folders` and `conversations`: NULL is the only value that can mean
    "never was", and trash is a state a note comes back out of. The row is
    removed for good only by DELETE.
    """

    __tablename__ = "notes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    folder_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("note_folders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # `Text`, not `String(n)`: a note has no length anybody could name, and a
    # ceiling would be discovered by whoever first hit it mid-sentence.
    body: Mapped[str] = mapped_column(
        Text, nullable=False, default="", server_default=text("''")
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
    folder: Mapped[NoteFolder | None] = relationship()

    @property
    def archived(self) -> bool:
        return self.archived_at is not None

    @property
    def trashed(self) -> bool:
        return self.deleted_at is not None

    def __repr__(self) -> str:
        return f"<Note {self.body[:24]!r}>"
