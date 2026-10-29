"""no booking notice by default

Revision ID: 0015
Revises: 0014
Create Date: 2026-08-17

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0015"
down_revision: str | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "businesses",
        "min_lead_minutes",
        existing_type=sa.Integer(),
        existing_nullable=False,
        server_default=sa.text("0"),
    )
    # Existing rows carry the old hour; nobody chose it, it was the default.
    op.execute("update businesses set min_lead_minutes = 0 where min_lead_minutes = 60")


def downgrade() -> None:
    op.alter_column(
        "businesses",
        "min_lead_minutes",
        existing_type=sa.Integer(),
        existing_nullable=False,
        server_default=sa.text("60"),
    )
