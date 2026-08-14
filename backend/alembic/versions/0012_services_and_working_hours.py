"""price list and opening hours

Revision ID: 0012
Revises: 0011
Create Date: 2026-08-14

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "services",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("price", sa.Integer(), nullable=False),
        sa.Column(
            "is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
        sa.Column("position", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["business_id"],
            ["businesses.id"],
            name=op.f("fk_services_business_id_businesses"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_services")),
    )
    op.create_index(
        op.f("ix_services_business_id"), "services", ["business_id"], unique=False
    )

    op.create_table(
        "working_hours",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("weekday", sa.Integer(), nullable=False),
        sa.Column("opens_at", sa.Time(), nullable=True),
        sa.Column("closes_at", sa.Time(), nullable=True),
        sa.Column("break_starts_at", sa.Time(), nullable=True),
        sa.Column("break_ends_at", sa.Time(), nullable=True),
        sa.ForeignKeyConstraint(
            ["business_id"],
            ["businesses.id"],
            name=op.f("fk_working_hours_business_id_businesses"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_working_hours")),
        # One row per weekday per business: a duplicate would make "when are
        # you open on Tuesday" ambiguous.
        sa.UniqueConstraint(
            "business_id", "weekday", name="uq_working_hours_business_day"
        ),
    )
    op.create_index(
        op.f("ix_working_hours_business_id"),
        "working_hours",
        ["business_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_working_hours_business_id"), table_name="working_hours")
    op.drop_table("working_hours")
    op.drop_index(op.f("ix_services_business_id"), table_name="services")
    op.drop_table("services")
