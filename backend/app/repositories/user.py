from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import datetime, timedelta

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import User


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        return await self._session.get(User, user_id)

    async def get_by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == email.lower())
        return await self._session.scalar(stmt)

    async def get_by_identifier(self, identifier: str) -> User | None:
        """Look a user up by either their email or their username.

        Both branches are index-backed: `email` is stored lower-cased with a
        plain unique index, `username` has a unique index on `lower(username)`.
        """
        needle = identifier.lower()
        stmt = select(User).where(
            or_(User.email == needle, func.lower(User.username) == needle)
        )
        return await self._session.scalar(stmt)

    async def email_exists(self, email: str) -> bool:
        stmt = select(User.id).where(User.email == email.lower()).limit(1)
        return await self._session.scalar(stmt) is not None

    async def username_exists(self, username: str) -> bool:
        stmt = (
            select(User.id)
            .where(func.lower(User.username) == username.lower())
            .limit(1)
        )
        return await self._session.scalar(stmt) is not None

    async def list_purgeable(self, now: datetime) -> Sequence[User]:
        """Accounts whose deletion grace period has run out.

        The cutoff is computed here rather than stored, so changing
        `account_deletion_grace_days` applies to everything already waiting.
        """
        cutoff = now - timedelta(days=settings.account_deletion_grace_days)
        stmt = select(User).where(
            User.deleted_at.is_not(None), User.deleted_at <= cutoff
        )
        return (await self._session.scalars(stmt)).all()

    def add(self, user: User) -> None:
        self._session.add(user)

    async def delete(self, user: User) -> None:
        """Hard delete. Refresh tokens and code rows go with it via
        `ON DELETE CASCADE`."""
        await self._session.delete(user)
