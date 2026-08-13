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
    # Null until a code sent to this address has been confirmed. Registration
    # does not verify, so every existing account starts out unverified — the
    # profile is where it gets proved.
    email_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    username: Mapped[str] = mapped_column(String(32), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # Filename only, not a full URL — the serving prefix comes from
    # `settings.avatar_url_prefix`, so moving storage doesn't rewrite rows.
    avatar_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )
    # Set when the user asks to delete the account; the row survives until the
    # grace period runs out. Kept separate from `is_active`, which means "an
    # administrator switched this off" and has to say something different.
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
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
    def email_verified(self) -> bool:
        return self.email_verified_at is not None

    @property
    def purge_due_at(self) -> datetime | None:
        """When this account stops being recoverable, or None if it isn't
        scheduled for deletion."""
        from datetime import timedelta

        from app.core.config import settings

        if self.deleted_at is None:
            return None
        return self.deleted_at + timedelta(days=settings.account_deletion_grace_days)

    @property
    def full_name(self) -> str | None:
        """Display name, joined from the stored parts.

        Computed rather than stored so there is exactly one source of truth:
        editing the first or last name can never leave a stale joined copy
        behind. `UserPublic` picks this up via `from_attributes`.
        """
        joined = " ".join(part for part in (self.first_name, self.last_name) if part)
        return joined or None

    @property
    def avatar_url(self) -> str | None:
        """Serving URL for the stored avatar, or None.

        Computed rather than stored so the serving prefix can change without
        a data migration. `UserPublic` picks this up via `from_attributes`.
        """
        from app.core.images import AVATAR_STORE, image_url

        return image_url(AVATAR_STORE, self.avatar_filename)

    def __repr__(self) -> str:
        return f"<User {self.username} ({self.email})>"
