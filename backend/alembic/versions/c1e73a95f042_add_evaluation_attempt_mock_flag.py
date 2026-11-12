"""add evaluation attempt mock isolation flag

Revision ID: c1e73a95f042
Revises: b6d9e3107ca4
Create Date: 2026-11-11
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from app.core.schema_migration_helpers import ensure_attempt_mock_flag


revision: str = "c1e73a95f042"
down_revision: Union[str, Sequence[str], None] = "b6d9e3107ca4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    ensure_attempt_mock_flag()


def downgrade() -> None:
    with op.batch_alter_table("evaluation_attempts", schema=None) as batch_op:
        batch_op.drop_index("ix_evaluation_attempts_is_mock")
        batch_op.drop_column("is_mock")
