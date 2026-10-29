from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, func, text, true
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class RefreshToken(Base):
    """A single issued refresh token, stored only as a digest.

    Keeping them in the database (rather than relying on a self-contained JWT)
    is what makes logout and theft-response actually revoke access.
    """

    __tablename__ = "refresh_tokens"

    __table_args__ = (
        # "One live token per session" is what the whole sessions feature rests
        # on — it is why `/auth/me/sessions` can be a plain query instead of a
        # grouping over families. It used to be a convention the refresh path
        # was trusted to keep, and a race broke it: two refreshes in the same
        # millisecond left one family with two live rows. The conditional UPDATE
        # in `RefreshTokenRepository.revoke` is what prevents that; this index is
        # what makes it impossible, including for any path written later.
        #
        # A partial unique *index* rather than a constraint, because PostgreSQL
        # has no partial UNIQUE constraint — and the predicate is essential:
        # revoked rows pile up per family by design, so the uniqueness can only
        # apply to the live one.
        Index(
            "uq_refresh_tokens_live_family",
            "family_id",
            unique=True,
            postgresql_where=text("revoked_at IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    # One signed-in device, surviving rotation: every replacement token carries
    # the same family forward, so a session keeps its identity (and its original
    # sign-in time) even though the row behind it is replaced on every refresh.
    family_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    # Captured at sign-in and copied across rotations — purely so the sessions
    # list has something a person can recognise.
    user_agent: Mapped[str | None] = mapped_column(String(256), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    # When the *session* began, as opposed to `created_at`, which is when this
    # particular token was minted — i.e. the last refresh.
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    # "Запомнить меня", answered once at sign-in and copied across every
    # rotation — without that the flag would last exactly one refresh, and a
    # session the user asked *not* to remember would quietly promote itself to
    # the full 30 days the first time its access token expired.
    #
    # It only sets how long `expires_at` is granted for; the client separately
    # decides whether to keep the token past the browser closing. Both halves
    # are needed: the store alone leaves a live token on the server that nobody
    # holds, and the lifetime alone leaves it on a shared machine's disk.
    remember: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=true()
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    user: Mapped[User] = relationship(back_populates="refresh_tokens")
