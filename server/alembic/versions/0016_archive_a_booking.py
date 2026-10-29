"""archive a booking out of the calendar

Revision ID: 0016
Revises: 0015
Create Date: 2026-08-18 12:17:10.681267

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0016"
down_revision: str | None = "0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Nullable with no default: every existing booking is un-archived, which is
    # what NULL already says. Nothing to backfill.
    op.add_column(
        "appointments",
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("appointments", "archived_at")
