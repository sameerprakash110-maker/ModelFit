"""Idempotent helpers for overlapping historical auth/ownership migrations.

The auth schema was introduced independently on two branches. These helpers let
both published revision paths converge on the same schema during an upgrade.
"""

import sqlalchemy as sa
from alembic import op


def _inspector():
    return sa.inspect(op.get_bind())


def ensure_users_table() -> None:
    if "users" not in _inspector().get_table_names():
        op.create_table(
            "users",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("email", sa.String(length=320), nullable=False),
            sa.Column("hashed_password", sa.String(length=255), nullable=False),
            sa.Column("full_name", sa.String(length=255), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )

    indexes = {index["name"] for index in _inspector().get_indexes("users")}
    if "ix_users_id" not in indexes:
        op.create_index("ix_users_id", "users", ["id"], unique=False)
    if "ix_users_email" not in indexes:
        op.create_index("ix_users_email", "users", ["email"], unique=True)


def ensure_project_owner() -> None:
    inspector = _inspector()
    columns = {column["name"] for column in inspector.get_columns("projects")}
    if "owner_id" not in columns:
        with op.batch_alter_table("projects", schema=None) as batch_op:
            batch_op.add_column(sa.Column("owner_id", sa.String(length=36), nullable=True))

    foreign_keys = {key.get("name") for key in _inspector().get_foreign_keys("projects")}
    if "fk_projects_owner_id_users" not in foreign_keys:
        with op.batch_alter_table("projects", schema=None) as batch_op:
            batch_op.create_foreign_key(
                "fk_projects_owner_id_users",
                "users",
                ["owner_id"],
                ["id"],
                ondelete="CASCADE",
            )

    indexes = {index["name"] for index in _inspector().get_indexes("projects")}
    if "ix_projects_owner_id" not in indexes:
        op.create_index("ix_projects_owner_id", "projects", ["owner_id"], unique=False)


def ensure_attempt_mock_flag() -> None:
    inspector = _inspector()
    columns = {column["name"] for column in inspector.get_columns("evaluation_attempts")}
    if "is_mock" not in columns:
        with op.batch_alter_table("evaluation_attempts", schema=None) as batch_op:
            batch_op.add_column(
                sa.Column("is_mock", sa.Boolean(), nullable=False, server_default=sa.false())
            )

    indexes = {index["name"] for index in _inspector().get_indexes("evaluation_attempts")}
    if "ix_evaluation_attempts_is_mock" not in indexes:
        op.create_index(
            "ix_evaluation_attempts_is_mock",
            "evaluation_attempts",
            ["is_mock"],
            unique=False,
        )
