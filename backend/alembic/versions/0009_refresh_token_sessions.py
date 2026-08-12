"""give refresh tokens a session identity and device details

Revision ID: 0009
Revises: 0008
Create Date: 2026-08-12

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Added nullable, backfilled, then made NOT NULL: existing rows have no
    # family and the column can't be created NOT NULL without a value for them.
    op.add_column(
        "refresh_tokens",
        sa.Column("family_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "refresh_tokens", sa.Column("user_agent", sa.String(length=256), nullable=True)
    )
    op.add_column(
        "refresh_tokens", sa.Column("ip_address", sa.String(length=45), nullable=True)
    )
    op.add_column(
        "refresh_tokens",
        sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Every pre-existing token becomes its own one-token session: there is no
    # record of which rotations belonged together, and guessing would merge
    # unrelated devices into one row in the sessions list.
    op.execute(
        """
        UPDATE refresh_tokens
        SET family_id = gen_random_uuid(),
            first_seen_at = created_at
        """
    )

    op.alter_column("refresh_tokens", "family_id", nullable=False)
    op.alter_column(
        "refresh_tokens",
        "first_seen_at",
        nullable=False,
        server_default=sa.text("now()"),
    )
    op.create_index(
        op.f("ix_refresh_tokens_family_id"),
        "refresh_tokens",
        ["family_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_refresh_tokens_family_id"), table_name="refresh_tokens")
    op.drop_column("refresh_tokens", "first_seen_at")
    op.drop_column("refresh_tokens", "ip_address")
    op.drop_column("refresh_tokens", "user_agent")
    op.drop_column("refresh_tokens", "family_id")
