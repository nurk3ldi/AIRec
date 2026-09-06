"""folders the owner makes for their own notes

**«Все заметки», «Архив» and «Корзина» are deliberately not rows here.** Those
three are states a note can be in, not folders anybody made, so they live in the
frontend as a constant. Seeding them would give every account three rows nobody
may rename or delete, and the first code path that forgot to exclude them would
offer to.

**`archived_at` and `deleted_at` are timestamps, not a status column** — the
same shape as `conversations.archived_at` and `appointments.archived_at`, and
for the same reason: NULL is the only value that can mean "never was", and "when
did this go into the bin" comes free from a column that had to exist anyway.
Trash is a state a folder comes back out of; the row is removed only by DELETE.

Revision ID: 0023
Revises: 0022
Create Date: 2026-09-06 14:10:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision: str = '0023'
down_revision: str | None = '0022'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'note_folders',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('business_id', UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column(
            'position',
            sa.Integer(),
            nullable=False,
            server_default=sa.text('0'),
        ),
        sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ['business_id'],
            ['businesses.id'],
            name=op.f('fk_note_folders_business_id_businesses'),
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_note_folders')),
    )
    op.create_index(
        op.f('ix_note_folders_business_id'),
        'note_folders',
        ['business_id'],
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_note_folders_business_id'), table_name='note_folders')
    op.drop_table('note_folders')
