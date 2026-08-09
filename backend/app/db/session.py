from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

engine: AsyncEngine = create_async_engine(
    str(settings.database_url),
    echo=settings.db_echo,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    # Drops connections a proxy or the server may have silently closed, instead
    # of failing the first query that lands on a dead one.
    pool_pre_ping=True,
    pool_recycle=settings.db_pool_recycle_seconds,
)

session_factory = async_sessionmaker(
    engine,
    expire_on_commit=False,
    autoflush=False,
)


async def get_session() -> AsyncIterator[AsyncSession]:
    """Request-scoped session.

    Leaving the context manager closes the session, which rolls back anything
    still open — so a handler that raises can never leak a half-applied write.
    """
    async with session_factory() as session:
        yield session
