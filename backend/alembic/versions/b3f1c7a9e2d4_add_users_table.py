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
from app.core.schema_migration_helpers import ensure_users_table


revision: str = "b3f1c7a9e2d4"
down_revision: Union[str, Sequence[str], None] = "d94c56b1a8e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create users if needed; another published branch may already have done so."""
    ensure_users_table()


def downgrade() -> None:
    """Drop the users table."""
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_table("users")
