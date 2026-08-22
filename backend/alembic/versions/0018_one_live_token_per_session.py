"""one live refresh token per session

Revision ID: 0018
Revises: 0017
Create Date: 2026-08-22 20:10:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0018"
down_revision: str | None = "0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Repair before enforcing. Two refreshes arriving in the same millisecond
    # with the same token both used to mint a replacement, so some families
    # already carry more than one live row — the duplicate "Текущий" device in
    # «Активные сессии». Keep the newest of each family and revoke the rest:
    # the newest is the one whose token the client actually kept, and the others
    # are credentials nobody holds.
    op.execute(
        sa.text(
            """
            UPDATE refresh_tokens AS t
            SET revoked_at = now()
            WHERE t.revoked_at IS NULL
              AND EXISTS (
                  SELECT 1
                  FROM refresh_tokens AS newer
                  WHERE newer.family_id = t.family_id
                    AND newer.revoked_at IS NULL
                    AND (newer.created_at, newer.id) > (t.created_at, t.id)
              )
            """
        )
    )

    # A partial unique index, because PostgreSQL has no partial UNIQUE
    # constraint. The predicate is the point: revoked rows accumulate per family
    # by design — every rotation leaves one behind — so only the live row can be
    # unique.
    op.create_index(
        "uq_refresh_tokens_live_family",
        "refresh_tokens",
        ["family_id"],
        unique=True,
        postgresql_where=sa.text("revoked_at IS NULL"),
    )


def downgrade() -> None:
    # The revocations above are not undone: they took away credentials that were
    # already unreachable, and re-issuing them is neither possible nor wanted.
    op.drop_index("uq_refresh_tokens_live_family", table_name="refresh_tokens")
