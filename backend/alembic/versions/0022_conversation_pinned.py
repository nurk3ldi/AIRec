"""a thread can be pinned to the top of the inbox

**Pinning is an ordering, not a filter, and that is why it is its own column
rather than a second use of `starred_at`.** Starring marks a thread so it can be
*listed* on its own; pinning says nothing about which list a thread belongs to
and everything about where it sits in whichever list is on screen. One flag
doing both would have made "show me the starred ones" and "keep this one at the
top" the same instruction.

A timestamp rather than a boolean, like `archived_at` and `starred_at` above it:
NULL is the only value that can mean "never was", and when several threads are
pinned the order they were pinned in is the order to show them in — free, from a
column that had to exist anyway.

Revision ID: 0022
Revises: 0021
Create Date: 2026-08-28 10:20:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = '0022'
down_revision: str | None = '0021'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'conversations',
        sa.Column('pinned_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('conversations', 'pinned_at')
