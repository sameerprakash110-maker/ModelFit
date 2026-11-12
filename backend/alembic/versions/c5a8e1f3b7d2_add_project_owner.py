"""add project owner

Revision ID: c5a8e1f3b7d2
Revises: b3f1c7a9e2d4
Create Date: 2026-11-11 00:00:00.000000

Persists project ownership so it survives restarts. Nullable: projects created
before accounts existed keep working.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from app.core.schema_migration_helpers import ensure_project_owner


revision: str = "c5a8e1f3b7d2"
down_revision: Union[str, Sequence[str], None] = "b3f1c7a9e2d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    ensure_project_owner()


def downgrade() -> None:
    with op.batch_alter_table("projects", schema=None) as batch_op:
        batch_op.drop_constraint("fk_projects_owner_id_users", type_="foreignkey")
        batch_op.drop_index("ix_projects_owner_id")
        batch_op.drop_column("owner_id")
