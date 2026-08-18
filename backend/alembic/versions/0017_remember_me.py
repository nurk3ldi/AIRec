"""remember a sign-in past the browser closing

Revision ID: 0017
Revises: 0016
Create Date: 2026-08-18 16:05:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0017"
down_revision: str | None = "0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # `server_default=true` is the honest backfill: every token issued before
    # this column existed was minted with the full 30-day lifetime, so calling
    # them all "remembered" describes what they already are rather than
    # deciding something new about them.
    #
    # The default stays on the column afterwards only as a safety net for a
    # hand-written INSERT — the application always states the value, because
    # `_issue_tokens` takes it as a required keyword.
    op.add_column(
        "refresh_tokens",
        sa.Column(
            "remember",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )


def downgrade() -> None:
    op.drop_column("refresh_tokens", "remember")
