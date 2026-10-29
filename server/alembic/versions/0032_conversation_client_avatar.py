"""a conversation remembers the client's profile photo

**`conversations.client_avatar_name`** — the client's Telegram profile photo,
fetched through the bot (`getUserProfilePhotos`) and stored in the chat store
like any other picture a client sent. NULL is ordinary: a client may have no
photo, or hide it from bots in their privacy settings.

**`client_avatar_checked_at`** — when that was last asked. Without it a client
with no photo would cost two Telegram calls on every message they send; with it
the question is asked at most once a day per thread, which is also how a
changed photo eventually arrives.

Revision ID: 0032
Revises: 0031
Create Date: 2026-09-18 23:00:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0032"
down_revision: str | None = "0031"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "conversations",
        sa.Column("client_avatar_name", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "conversations",
        sa.Column(
            "client_avatar_checked_at", sa.DateTime(timezone=True), nullable=True
        ),
    )


def downgrade() -> None:
    op.drop_column("conversations", "client_avatar_checked_at")
    op.drop_column("conversations", "client_avatar_name")
