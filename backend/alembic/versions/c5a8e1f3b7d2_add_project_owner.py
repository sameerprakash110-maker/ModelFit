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


revision: str = "c5a8e1f3b7d2"
down_revision: Union[str, Sequence[str], None] = "b3f1c7a9e2d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("projects", schema=None) as batch_op:
        batch_op.add_column(sa.Column("owner_id", sa.String(length=36), nullable=True))
        batch_op.create_index("ix_projects_owner_id", ["owner_id"], unique=False)
        batch_op.create_foreign_key(
            "fk_projects_owner_id_users", "users", ["owner_id"], ["id"], ondelete="CASCADE"
        )


def downgrade() -> None:
    with op.batch_alter_table("projects", schema=None) as batch_op:
        batch_op.drop_constraint("fk_projects_owner_id_users", type_="foreignkey")
        batch_op.drop_index("ix_projects_owner_id")
        batch_op.drop_column("owner_id")
