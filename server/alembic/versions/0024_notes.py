"""notes the owner writes for themselves

**One `body` column and no separate title.** The title is the first line of the
text, derived where the note is drawn. A stored title would be a second copy of
something the body already contains, and the two drift the moment somebody edits
that first line — after which the list and the note disagree about what the note
is called.

`folder_id` is nullable and `ON DELETE SET NULL`: a note in no folder is the
ordinary case — that is what «Все заметки» holds — and a folder thrown away must
not take its notes with it.

`archived_at` / `deleted_at` mirror `note_folders`: NULL is the only value that
can mean "never was", and trash is a state a note comes back out of.

Revision ID: 0024
Revises: 0023
Create Date: 2026-09-06 19:00:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision: str = '0024'
down_revision: str | None = '0023'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'notes',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('business_id', UUID(as_uuid=True), nullable=False),
        sa.Column('folder_id', UUID(as_uuid=True), nullable=True),
        sa.Column(
            'body', sa.Text(), nullable=False, server_default=sa.text("''")
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
            name=op.f('fk_notes_business_id_businesses'),
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['folder_id'],
            ['note_folders.id'],
            name=op.f('fk_notes_folder_id_note_folders'),
            ondelete='SET NULL',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_notes')),
    )
    op.create_index(op.f('ix_notes_business_id'), 'notes', ['business_id'])
    op.create_index(op.f('ix_notes_folder_id'), 'notes', ['folder_id'])


def downgrade() -> None:
    op.drop_index(op.f('ix_notes_folder_id'), table_name='notes')
    op.drop_index(op.f('ix_notes_business_id'), table_name='notes')
    op.drop_table('notes')
