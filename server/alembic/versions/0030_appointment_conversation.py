"""a booking remembers the conversation it was agreed in

**`appointments.conversation_id`** is set when the assistant files a booking
request from a chat. It is what lets the owner's decision travel back: confirming
or declining a pending booking tells *that* client, in *that* thread. It also
lets the assistant find the request it already filed, so a client who changes
the time mid-conversation moves one pending booking instead of leaving two.

`ON DELETE SET NULL`: deleting a conversation for good must not take the booking
with it — what was agreed is a calendar fact, and the chat is only how it was
agreed. Nullable because every booking written by hand has no chat at all.

Revision ID: 0030
Revises: 0029
Create Date: 2026-09-16 12:00:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0030"
down_revision: str | None = "0029"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "appointments",
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        op.f("fk_appointments_conversation_id_conversations"),
        "appointments",
        "conversations",
        ["conversation_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_appointments_conversation_id"), "appointments", ["conversation_id"]
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_appointments_conversation_id"), table_name="appointments")
    op.drop_constraint(
        op.f("fk_appointments_conversation_id_conversations"),
        "appointments",
        type_="foreignkey",
    )
    op.drop_column("appointments", "conversation_id")
