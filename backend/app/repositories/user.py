from __future__ import annotations

import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

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

    def add(self, user: User) -> None:
        self._session.add(user)
