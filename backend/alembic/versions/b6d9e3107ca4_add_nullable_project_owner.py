"""add nullable project owner foreign key

Revision ID: b6d9e3107ca4
Revises: a2f49d810c31
Create Date: 2026-11-11

Existing projects cannot be assigned to a user safely because ownership was
previously held only in process memory. Leave their owner_id NULL; no IDs are
invented or backfilled.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from app.core.schema_migration_helpers import ensure_project_owner


revision: str = "b6d9e3107ca4"
down_revision: Union[str, Sequence[str], None] = "a2f49d810c31"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    ensure_project_owner()


def downgrade() -> None:
    with op.batch_alter_table("projects", schema=None) as batch_op:
        batch_op.drop_index("ix_projects_owner_id")
        batch_op.drop_constraint("fk_projects_owner_id_users", type_="foreignkey")
        batch_op.drop_column("owner_id")
