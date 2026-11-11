"""add mock isolation columns

Revision ID: d94c56b1a8e2
Revises: 77cc2f419003
Create Date: 2026-11-11 00:00:00.000000

Adds native, indexed mock/live markers to benchmark configurations and their
evaluation records so analytics can filter simulated data in SQL.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "d94c56b1a8e2"
down_revision: Union[str, Sequence[str], None] = "77cc2f419003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add non-null mock flags and indexes without changing existing rows."""
    with op.batch_alter_table("benchmarks", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("is_mock", sa.Boolean(), nullable=False, server_default=sa.false())
        )
        batch_op.create_index("ix_benchmarks_is_mock", ["is_mock"], unique=False)

    with op.batch_alter_table("evaluations", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("is_mock", sa.Boolean(), nullable=False, server_default=sa.false())
        )
        batch_op.create_index("ix_evaluations_is_mock", ["is_mock"], unique=False)


def downgrade() -> None:
    """Remove mock-isolation columns and their indexes."""
    with op.batch_alter_table("evaluations", schema=None) as batch_op:
        batch_op.drop_index("ix_evaluations_is_mock")
        batch_op.drop_column("is_mock")

    with op.batch_alter_table("benchmarks", schema=None) as batch_op:
        batch_op.drop_index("ix_benchmarks_is_mock")
        batch_op.drop_column("is_mock")
