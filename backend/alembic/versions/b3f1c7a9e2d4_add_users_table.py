"""add users table

Revision ID: b3f1c7a9e2d4
Revises: d94c56b1a8e2
Create Date: 2026-11-11 00:00:00.000000

Persists user accounts in the database instead of the in-process registry,
so sign-ups survive server restarts.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "b3f1c7a9e2d4"
down_revision: Union[str, Sequence[str], None] = "d94c56b1a8e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the users table. Additive only."""
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_id", "users", ["id"], unique=False)
    op.create_index("ix_users_email", "users", ["email"], unique=True)


def downgrade() -> None:
    """Drop the users table."""
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_table("users")
