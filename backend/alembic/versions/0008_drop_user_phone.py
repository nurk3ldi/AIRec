"""drop the unused users.phone column

Revision ID: 0008
Revises: 0007
Create Date: 2026-08-12

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Added by 0004 but never wired to anything: no UI ever sent it and the
    # profile endpoint stopped accepting it. Dropping it beats leaving a column
    # that looks like a supported field.
    op.drop_column("users", "phone")


def downgrade() -> None:
    op.add_column("users", sa.Column("phone", sa.String(length=32), nullable=True))
