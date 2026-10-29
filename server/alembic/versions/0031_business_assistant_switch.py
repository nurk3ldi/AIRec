"""the assistant can be switched off for the whole business

**`businesses.assistant_enabled`**, default true. It is the dashboard's switch:
off, the assistant answers no client in any thread, and messages simply wait in
the inbox. Separate from `conversations.assistant_enabled`, which is the owner
stepping into one thread — this is the owner turning the whole thing off, and
turning it back on must not wake every thread somebody had taken over.

Revision ID: 0031
Revises: 0030
Create Date: 2026-09-16 16:00:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0031"
down_revision: str | None = "0030"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "businesses",
        sa.Column(
            "assistant_enabled", sa.Boolean(), nullable=False, server_default=sa.true()
        ),
    )


def downgrade() -> None:
    op.drop_column("businesses", "assistant_enabled")
