"""add users table project owner and attempt mock flag

Revision ID: f1b2c3d4e5a6
Revises: d94c56b1a8e2
Create Date: 2026-11-11 22:00:00.000000

Adds persistent users table for multi-user SaaS authentication,
links projects to user owners via owner_id foreign key, and adds
native is_mock column to evaluation_attempts for complete mock/live isolation.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from app.core.schema_migration_helpers import (
    ensure_attempt_mock_flag,
    ensure_project_owner,
    ensure_users_table,
)


revision: str = "f1b2c3d4e5a6"
down_revision: Union[str, Sequence[str], None] = "d94c56b1a8e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Converge on the auth schema if another revision path already applied part."""
    ensure_users_table()
    ensure_project_owner()
    ensure_attempt_mock_flag()


def downgrade() -> None:
    """Revert users table, project owner_id, and evaluation_attempts is_mock."""
    with op.batch_alter_table("evaluation_attempts", schema=None) as batch_op:
        batch_op.drop_index("ix_evaluation_attempts_is_mock")
        batch_op.drop_column("is_mock")

    with op.batch_alter_table("projects", schema=None) as batch_op:
        batch_op.drop_index("ix_projects_owner_id")
        batch_op.drop_constraint("fk_projects_owner_id_users", type_="foreignkey")
        batch_op.drop_column("owner_id")

    op.drop_index("ix_users_id", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
