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


revision: str = "f1b2c3d4e5a6"
down_revision: Union[str, Sequence[str], None] = "d94c56b1a8e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create users table, add project.owner_id and evaluation_attempts.is_mock."""
    # 1. Create users table
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_id", "users", ["id"], unique=False)

    # 2. Add owner_id to projects
    with op.batch_alter_table("projects", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("owner_id", sa.String(length=36), nullable=True)
        )
        batch_op.create_foreign_key(
            "fk_projects_owner_id_users",
            "users",
            ["owner_id"],
            ["id"],
            ondelete="CASCADE",
        )
        batch_op.create_index("ix_projects_owner_id", ["owner_id"], unique=False)

    # 3. Add is_mock to evaluation_attempts
    with op.batch_alter_table("evaluation_attempts", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("is_mock", sa.Boolean(), nullable=False, server_default=sa.false())
        )
        batch_op.create_index("ix_evaluation_attempts_is_mock", ["is_mock"], unique=False)


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
