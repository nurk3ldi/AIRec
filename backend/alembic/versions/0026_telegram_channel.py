"""the Telegram bot a business answers through, and a client who has no number

**`telegram_accounts` mirrors `whatsapp_accounts` and differs in one column.**
A Meta delivery names its own `phone_number_id` in the body, so the inbox it
belongs to can be read out of what arrived. A Telegram update names no bot at
all — the URL is the identity. `webhook_secret` is Telegram's own answer to
that (`setWebhook(secret_token=…)`, echoed back in
`X-Telegram-Bot-Api-Secret-Token`), so one shared path still resolves to one
bot: the column is the routing key *and* the proof the update is genuine, which
is why it is unique and generated rather than chosen.

**`conversations.client_phone` becomes nullable, and that is the part with
consequences.** On WhatsApp the number is the identity and always arrives; a
Telegram bot is given a numeric id and, at best, a `@username`, and never a
phone unless the client shares their contact card. Inventing one would put a
value nobody entered into the column search reads, so the column admits it does
not know — the same answer `appointments.ends_at` gives. `client_username` is
what a Telegram thread has instead.

Revision ID: 0026
Revises: 0025
Create Date: 2026-09-10 10:00:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision: str = '0026'
down_revision: str | None = '0025'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'telegram_accounts',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('business_id', UUID(as_uuid=True), nullable=False),
        sa.Column('bot_id', sa.BigInteger(), nullable=False),
        sa.Column('bot_username', sa.String(length=64), nullable=True),
        sa.Column('bot_token', sa.Text(), nullable=False),
        sa.Column('webhook_secret', sa.String(length=64), nullable=False),
        sa.Column('webhook_set_at', sa.DateTime(timezone=True), nullable=True),
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
            name=op.f('fk_telegram_accounts_business_id_businesses'),
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_telegram_accounts')),
        sa.UniqueConstraint('bot_id', name=op.f('uq_telegram_accounts_bot_id')),
    )
    op.create_index(
        op.f('ix_telegram_accounts_business_id'),
        'telegram_accounts',
        ['business_id'],
        unique=True,
    )
    op.create_index(
        op.f('ix_telegram_accounts_webhook_secret'),
        'telegram_accounts',
        ['webhook_secret'],
        unique=True,
    )

    # A thread on Telegram may have no number at all.
    op.alter_column(
        'conversations',
        'client_phone',
        existing_type=sa.String(length=32),
        nullable=True,
    )
    op.add_column(
        'conversations',
        sa.Column('client_username', sa.String(length=64), nullable=True),
    )

    # The channel column was built for this day; only its guard has to move.
    # The bare name, not the rendered one: `NAMING_CONVENTION` adds the
    # `ck_conversations_` prefix here too, and spelling it applies it twice.
    op.drop_constraint('channel', 'conversations', type_='check')
    op.create_check_constraint(
        'channel', 'conversations', "channel in ('whatsapp', 'telegram')"
    )


def downgrade() -> None:
    op.drop_constraint('channel', 'conversations', type_='check')
    op.create_check_constraint('channel', 'conversations', "channel in ('whatsapp')")

    op.drop_column('conversations', 'client_username')
    # Anything Telegram wrote has no number to restore, so the column cannot go
    # back to NOT NULL while those rows exist. They are removed first: this is
    # a downgrade of the migration that made them possible, and leaving a
    # conversation whose channel the CHECK above no longer allows would be
    # worse than losing it.
    op.execute("DELETE FROM conversations WHERE channel = 'telegram'")
    op.execute("UPDATE conversations SET client_phone = '' WHERE client_phone IS NULL")
    op.alter_column(
        'conversations',
        'client_phone',
        existing_type=sa.String(length=32),
        nullable=False,
    )

    op.drop_index(op.f('ix_telegram_accounts_webhook_secret'), table_name='telegram_accounts')
    op.drop_index(op.f('ix_telegram_accounts_business_id'), table_name='telegram_accounts')
    op.drop_table('telegram_accounts')
