"""rename nickname to username

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-09

"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Renaming the column also updates the `lower(nickname)` expression inside
    # the functional index automatically (Postgres tracks it by column, not by
    # text) — but the index's own *name* needs renaming separately to match.
    op.alter_column("users", "nickname", new_column_name="username")
    op.execute("ALTER INDEX uq_users_nickname_lower RENAME TO uq_users_username_lower")


def downgrade() -> None:
    op.execute("ALTER INDEX uq_users_username_lower RENAME TO uq_users_nickname_lower")
    op.alter_column("users", "username", new_column_name="nickname")
