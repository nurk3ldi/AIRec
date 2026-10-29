"""a booking may have a start and no end

The owner writing somebody down as they walk in knows when they arrived and not
how long they will be. Refusing that made the panel demand a number nobody had,
and a guessed end is worse than no end: it is a fact the calendar states and
nobody checked.

So `ends_at` and `duration_minutes` both become nullable, and NULL in either
means the same thing — this booking has no end yet. They are always NULL
together; the service is their only writer and never sets one without the other.

**No check constraint changes are needed and that is worth knowing rather than
assuming.** `span` (`ends_at > starts_at`) and `duration` (`duration_minutes > 0`)
both evaluate to NULL for an open-ended row, and a CHECK passes on anything that
is not FALSE — so the two constraints go on meaning exactly what they meant for
every row that does have an end.

An open-ended booking **occupies nothing**: it is a record of an arrival, not a
claim on a stretch of the day, and blocking an unknown length would be inventing
the very fact the owner declined to state. `AppointmentRepository.list_blocking`
leaves these rows out, and `list_in_range` had to learn to include them by their
start instead — `ends_at > start` is NULL for them, so a plain range query would
have dropped every open booking off the grid it was drawn on.

Revision ID: 0021
Revises: 0020
Create Date: 2026-08-27 13:10:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = '0021'
down_revision: str | None = '0020'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        'appointments',
        'ends_at',
        existing_type=sa.DateTime(timezone=True),
        nullable=True,
    )
    op.alter_column(
        'appointments',
        'duration_minutes',
        existing_type=sa.Integer(),
        nullable=True,
    )


def downgrade() -> None:
    """Open-ended bookings cannot survive going back, so they are closed first.

    Fifteen minutes is `SLOT_MINUTES`, the smallest span this product can
    express — the least invented length available, chosen because the column has
    to hold *something* before it can be NOT NULL again.
    """
    op.execute(
        """
        UPDATE appointments
           SET duration_minutes = 15,
               ends_at = starts_at + interval '15 minutes'
         WHERE ends_at IS NULL
        """
    )
    op.alter_column(
        'appointments',
        'duration_minutes',
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.alter_column(
        'appointments',
        'ends_at',
        existing_type=sa.DateTime(timezone=True),
        nullable=False,
    )
