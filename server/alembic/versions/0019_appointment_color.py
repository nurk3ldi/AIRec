"""a booking may carry a colour of its own

Revision ID: 0019
Revises: 0018
Create Date: 2026-08-25 12:00:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0019"
down_revision: str | None = "0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # **A name, not a hex.** The column holds `orange` or `green`, and what
    # those look like is the frontend's business — which is the only way a
    # colour can differ between the light theme and the dark one, and the only
    # way the palette can be adjusted later without an UPDATE over every row
    # ever written.
    #
    # Nullable, and null is the default: a booking without a colour is the
    # ordinary case and wears the same grey as every other card.
    op.add_column(
        "appointments",
        sa.Column("color", sa.String(length=16), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("appointments", "color")
