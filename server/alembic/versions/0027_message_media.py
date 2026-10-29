"""the photo that came with a message

**A filename, not a URL and not the bytes.** The column keeps the name the file
was stored under and `Message.media_url` prepends the prefix — the same split
`users.avatar_file` makes, so where chat media lives can move without an
`UPDATE` over every row. The bytes go to disk under `uploads/chat`, for the
reason avatars and logos do: a database is a poor filesystem, and Postgres
would be holding megabytes nobody queries.

**The text column keeps its placeholder.** A photo still arrives as «[фото]»
plus the caption in `body`, and that stays true after this: the placeholder is
what a search over message bodies matches and what the thread list shows as a
preview, neither of which can hold an image. The file is what the bubble draws;
the words are what the rest of the product reads.

Nullable, because most messages are words — and because every message written
before this migration is one.

Revision ID: 0027
Revises: 0026
Create Date: 2026-09-12 10:00:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0027"
down_revision: str | None = "0026"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "messages",
        sa.Column("media_name", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("messages", "media_name")
