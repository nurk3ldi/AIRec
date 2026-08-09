"""user profile fields

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-09

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("full_name", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("phone", sa.String(length=32), nullable=True))
    op.add_column(
        "users", sa.Column("avatar_filename", sa.String(length=255), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("users", "avatar_filename")
    op.drop_column("users", "phone")
    op.drop_column("users", "full_name")
