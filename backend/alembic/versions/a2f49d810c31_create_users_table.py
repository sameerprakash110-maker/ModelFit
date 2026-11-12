"""create persistent users table

Revision ID: a2f49d810c31
Revises: d94c56b1a8e2
Create Date: 2026-11-11
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from app.core.schema_migration_helpers import ensure_users_table


revision: str = "a2f49d810c31"
down_revision: Union[str, Sequence[str], None] = "d94c56b1a8e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    ensure_users_table()


def downgrade() -> None:
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_table("users")
