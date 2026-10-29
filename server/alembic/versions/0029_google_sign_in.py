"""sign in with Google: a Google subject on the user, and a password that may be absent

**`google_sub`, not the email, is what a Google account is found by.** The
address on a Google account can change; the `sub` Google issues never does and
is never reused, so it is the stable key. It is unique and nullable — most
accounts never touch Google.

**`password_hash` becomes nullable**, because an account created through Google
has no password, and inventing one — a random hash nobody knows — would be a
credential that exists only to be guessed at. `verify_password` already treats a
missing hash as "no match" while still spending the time, so password sign-in
for such an account fails exactly like a wrong password. Setting a password
later goes through the emailed-code path the profile already has.

Revision ID: 0029
Revises: 0028
Create Date: 2026-09-13 18:00:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0029"
down_revision: str | None = "0028"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("google_sub", sa.String(length=255), nullable=True))
    op.create_unique_constraint("uq_users_google_sub", "users", ["google_sub"])
    op.alter_column("users", "password_hash", existing_type=sa.String(length=255), nullable=True)


def downgrade() -> None:
    # A Google-only account has no password to restore the constraint over; the
    # downgrade refuses rather than inventing one.
    op.alter_column("users", "password_hash", existing_type=sa.String(length=255), nullable=False)
    op.drop_constraint("uq_users_google_sub", "users", type_="unique")
    op.drop_column("users", "google_sub")
