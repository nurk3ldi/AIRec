"""soft-delete accounts with a grace period

Revision ID: 0010
Revises: 0009
Create Date: 2026-08-12

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True)
    )
    # Indexed because the purge job scans on it, and that scan runs against the
    # whole table rather than a single account.
    op.create_index(op.f("ix_users_deleted_at"), "users", ["deleted_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_deleted_at"), table_name="users")
    op.drop_column("users", "deleted_at")
