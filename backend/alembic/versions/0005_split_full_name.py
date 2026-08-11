"""split full_name into first_name and last_name

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-11

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("first_name", sa.String(length=50), nullable=True))
    op.add_column("users", sa.Column("last_name", sa.String(length=50), nullable=True))

    # Existing rows hold one joined string: everything before the first space is
    # the given name, the remainder is the surname. Names with no space keep
    # first_name only, and the 50-char columns are filled with left(...) so an
    # over-long legacy value truncates instead of failing the migration.
    op.execute(
        """
        UPDATE users
        SET first_name = NULLIF(left(split_part(trim(full_name), ' ', 1), 50), ''),
            last_name = NULLIF(
                left(
                    trim(
                        substr(
                            trim(full_name),
                            length(split_part(trim(full_name), ' ', 1)) + 1
                        )
                    ),
                    50
                ),
                ''
            )
        WHERE full_name IS NOT NULL
        """
    )

    op.drop_column("users", "full_name")


def downgrade() -> None:
    op.add_column("users", sa.Column("full_name", sa.String(length=100), nullable=True))
    op.execute(
        """
        UPDATE users
        SET full_name = NULLIF(
            trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')),
            ''
        )
        """
    )
    op.drop_column("users", "last_name")
    op.drop_column("users", "first_name")
