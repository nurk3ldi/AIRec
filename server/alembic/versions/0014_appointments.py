"""appointments and booking rules

Revision ID: 0014
Revises: 0013
Create Date: 2026-08-14

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "businesses",
        sa.Column("capacity", sa.Integer(), nullable=False, server_default=sa.text("1")),
    )
    op.add_column(
        "businesses",
        sa.Column(
            "booking_horizon_days",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("60"),
        ),
    )
    op.add_column(
        "businesses",
        sa.Column(
            "min_lead_minutes",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("60"),
        ),
    )

    op.create_table(
        "appointments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("service_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("service_name", sa.String(length=120), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("price", sa.Integer(), nullable=False),
        sa.Column("client_name", sa.String(length=120), nullable=False),
        sa.Column("client_phone", sa.String(length=32), nullable=True),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "source",
            sa.String(length=16),
            nullable=False,
            server_default="manual",
        ),
        sa.Column("note", sa.String(length=500), nullable=True),
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
        sa.CheckConstraint("duration_minutes > 0", name=op.f("ck_appointments_duration")),
        sa.CheckConstraint("ends_at > starts_at", name=op.f("ck_appointments_span")),
        sa.CheckConstraint(
            "status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')",
            name=op.f("ck_appointments_status"),
        ),
        sa.ForeignKeyConstraint(
            ["business_id"],
            ["businesses.id"],
            name=op.f("fk_appointments_business_id_businesses"),
            ondelete="CASCADE",
        ),
        # SET NULL: a service leaving the price list must not take its history
        # with it — the booking keeps its own copy of the name, price and length.
        sa.ForeignKeyConstraint(
            ["service_id"],
            ["services.id"],
            name=op.f("fk_appointments_service_id_services"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_appointments")),
    )
    op.create_index(
        op.f("ix_appointments_business_id"), "appointments", ["business_id"]
    )
    op.create_index(
        op.f("ix_appointments_service_id"), "appointments", ["service_id"]
    )
    op.create_index(
        "ix_appointments_business_starts",
        "appointments",
        ["business_id", "starts_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_appointments_business_starts", table_name="appointments")
    op.drop_index(op.f("ix_appointments_service_id"), table_name="appointments")
    op.drop_index(op.f("ix_appointments_business_id"), table_name="appointments")
    op.drop_table("appointments")
    op.drop_column("businesses", "min_lead_minutes")
    op.drop_column("businesses", "booking_horizon_days")
    op.drop_column("businesses", "capacity")
