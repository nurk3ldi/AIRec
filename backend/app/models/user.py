from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Index, String, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.refresh_token import RefreshToken


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        # Usernames keep the casing the user typed, but must be unique
        # case-insensitively — "Aruzhan" and "aruzhan" are the same account.
        # The functional index is also what the login lookup query hits.
        Index("uq_users_username_lower", text("lower(username)"), unique=True),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Stored already lower-cased (normalised in the schema layer), so a plain
    # unique index is enough.
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True)
    username: Mapped[str] = mapped_column(String(32), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # Filename only, not a full URL — the serving prefix comes from
    # `settings.avatar_url_prefix`, so moving storage doesn't rewrite rows.
    avatar_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
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

    refresh_tokens: Mapped[list[RefreshToken]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    @property
    def avatar_url(self) -> str | None:
        """Serving URL for the stored avatar, or None.

        Computed rather than stored so the serving prefix can change without
        a data migration. `UserPublic` picks this up via `from_attributes`.
        """
        from app.core.avatar import avatar_url as build_avatar_url

        return build_avatar_url(self.avatar_filename)

    def __repr__(self) -> str:
        return f"<User {self.username} ({self.email})>"
