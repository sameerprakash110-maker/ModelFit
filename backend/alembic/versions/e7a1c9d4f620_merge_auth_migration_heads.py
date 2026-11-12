"""Merge the independently created authentication migration branches.

Revision ID: e7a1c9d4f620
Revises: c1e73a95f042, c5a8e1f3b7d2, f1b2c3d4e5a6
Create Date: 2026-11-12
"""
from typing import Sequence, Union

revision: str = "e7a1c9d4f620"
down_revision: Union[str, Sequence[str], None] = (
    "c1e73a95f042",
    "c5a8e1f3b7d2",
    "f1b2c3d4e5a6",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Join converged users, project ownership, and attempt mock revisions."""


def downgrade() -> None:
    """No schema changes are made by this merge revision."""
