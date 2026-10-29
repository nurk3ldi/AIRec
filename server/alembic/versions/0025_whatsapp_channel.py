"""the WhatsApp number a business answers on, and how far our messages got

**`whatsapp_accounts` is a table rather than columns on `businesses`.** It holds
an access token, which is a password to somebody's WhatsApp, and a business row
is what `GET /business` returns on every page load — keeping the credential out
of it means no field added there later can leak it by accident. `phone_number_id`
carries the unique index because that, and never the phone number, is what an
inbound delivery names itself by.

**`messages.status` is NULL for anything the client sent.** Delivery is a claim
about something we sent; a message that arrived has arrived. `error` holds Meta's
sentence rather than its numeric code, because "вне 24-часового окна" tells the
owner what to do and `131047` does not.

Revision ID: 0025
Revises: 0024
Create Date: 2026-09-07 10:00:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision: str = '0025'
down_revision: str | None = '0024'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'whatsapp_accounts',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('business_id', UUID(as_uuid=True), nullable=False),
        sa.Column('phone_number_id', sa.String(length=32), nullable=False),
        sa.Column('waba_id', sa.String(length=32), nullable=True),
        sa.Column('display_phone_number', sa.String(length=32), nullable=True),
        sa.Column('verified_name', sa.String(length=120), nullable=True),
        sa.Column('access_token', sa.Text(), nullable=False),
        sa.Column(
            'connected_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ['business_id'],
            ['businesses.id'],
            name=op.f('fk_whatsapp_accounts_business_id_businesses'),
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_whatsapp_accounts')),
    )
    op.create_index(
        op.f('ix_whatsapp_accounts_business_id'),
        'whatsapp_accounts',
        ['business_id'],
        unique=True,
    )
    op.create_index(
        op.f('ix_whatsapp_accounts_phone_number_id'),
        'whatsapp_accounts',
        ['phone_number_id'],
        unique=True,
    )

    op.add_column('messages', sa.Column('status', sa.String(length=16), nullable=True))
    op.add_column('messages', sa.Column('error', sa.Text(), nullable=True))
    op.create_check_constraint(
        'status',
        'messages',
        "status is null or status in "
        "('pending', 'sent', 'delivered', 'read', 'failed')",
    )


def downgrade() -> None:
    op.drop_constraint(op.f('ck_messages_status'), 'messages', type_='check')
    op.drop_column('messages', 'error')
    op.drop_column('messages', 'status')
    op.drop_index(
        op.f('ix_whatsapp_accounts_phone_number_id'), table_name='whatsapp_accounts'
    )
    op.drop_index(
        op.f('ix_whatsapp_accounts_business_id'), table_name='whatsapp_accounts'
    )
    op.drop_table('whatsapp_accounts')
