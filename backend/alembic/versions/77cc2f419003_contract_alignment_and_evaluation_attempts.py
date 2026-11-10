"""contract_alignment_and_evaluation_attempts

Revision ID: 77cc2f419003
Revises: 02505316186f
Create Date: 2026-11-10 09:41:00.000000

Changes in this migration
--------------------------
evaluations table
  • prompt_tokens  → input_tokens   (Integer, NOT NULL, server_default '0')
  • completion_tokens → output_tokens (Integer, NOT NULL, server_default '0')
  • total_cost     → execution_cost  (Numeric 12,8, NOT NULL, server_default '0')
  • latency_ms                       (Float,   NOT NULL, server_default '0')  — make non-null
  • judge_score    → quality_score   (Float, nullable)
  • ADD attempt_count  Integer NOT NULL default 1
  • ADD repeat_index   Integer NOT NULL default 0
  • ADD prompt_version String(64) NOT NULL default 'original'
  • ADD judge_reasoning Text nullable

benchmarks table
  • ADD completed_at  DateTime nullable
  • ADD baseline_model String(100) nullable
  • ADD repeats       Integer NOT NULL default 1

projects table
  • system_prompt NOT NULL (server_default '' for existing NULLs)
  • ADD output_schema JSON nullable
  • ADD rubric       JSON nullable

test_cases table
  • evaluation_criteria Text → JSON  (batch recreate; existing text values become NULL)

New table: evaluation_attempts

All renames use alter_column(new_column_name=…) inside batch_alter_table so
that existing row data is preserved (required for SQLite which rewrites the table).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "77cc2f419003"
down_revision: Union[str, Sequence[str], None] = "02505316186f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ---------------------------------------------------------------------------
# Upgrade
# ---------------------------------------------------------------------------

def upgrade() -> None:
    """Apply contract-alignment changes and create evaluation_attempts."""

    # Existing nullable values must be normalised before SQLite recreates the
    # tables with NOT NULL constraints below.
    op.execute("UPDATE evaluations SET prompt_tokens = 0 WHERE prompt_tokens IS NULL")
    op.execute("UPDATE evaluations SET completion_tokens = 0 WHERE completion_tokens IS NULL")
    op.execute("UPDATE evaluations SET total_cost = 0 WHERE total_cost IS NULL")
    op.execute("UPDATE evaluations SET latency_ms = 0 WHERE latency_ms IS NULL")
    op.execute("UPDATE projects SET system_prompt = '' WHERE system_prompt IS NULL")
    op.execute("UPDATE test_cases SET expected_behavior = '' WHERE expected_behavior IS NULL")

    # ------------------------------------------------------------------
    # 1. evaluations — renames, nullability fixes, additive columns
    # ------------------------------------------------------------------
    with op.batch_alter_table("evaluations", schema=None) as batch_op:
        # Rename prompt_tokens → input_tokens (backfill NULLs with 0)
        batch_op.alter_column(
            "prompt_tokens",
            new_column_name="input_tokens",
            existing_type=sa.Integer(),
            type_=sa.Integer(),
            existing_nullable=True,
            nullable=False,
            server_default="0",
        )
        # Rename completion_tokens → output_tokens
        batch_op.alter_column(
            "completion_tokens",
            new_column_name="output_tokens",
            existing_type=sa.Integer(),
            type_=sa.Integer(),
            existing_nullable=True,
            nullable=False,
            server_default="0",
        )
        # Rename total_cost → execution_cost, change type to Numeric(12,8)
        batch_op.alter_column(
            "total_cost",
            new_column_name="execution_cost",
            existing_type=sa.Float(),
            type_=sa.Numeric(12, 8),
            existing_nullable=True,
            nullable=False,
            server_default="0",
        )
        # latency_ms: make NOT NULL, backfill NULLs with 0
        batch_op.alter_column(
            "latency_ms",
            existing_type=sa.Float(),
            type_=sa.Float(),
            existing_nullable=True,
            nullable=False,
            server_default="0",
        )
        # Rename judge_score → quality_score (stays nullable)
        batch_op.alter_column(
            "judge_score",
            new_column_name="quality_score",
            existing_type=sa.Float(),
            type_=sa.Float(),
            existing_nullable=True,
            nullable=True,
        )
        # Additive NOT NULL columns with meaningful defaults
        batch_op.add_column(
            sa.Column(
                "attempt_count",
                sa.Integer(),
                nullable=False,
                server_default="1",
            )
        )
        batch_op.add_column(
            sa.Column(
                "repeat_index",
                sa.Integer(),
                nullable=False,
                server_default="0",
            )
        )
        batch_op.add_column(
            sa.Column(
                "prompt_version",
                sa.String(length=64),
                nullable=False,
                server_default="original",
            )
        )
        # judge_reasoning stays nullable — only populated when judge runs
        batch_op.add_column(
            sa.Column("judge_reasoning", sa.Text(), nullable=True)
        )

    # ------------------------------------------------------------------
    # 2. benchmarks — additive columns
    # ------------------------------------------------------------------
    with op.batch_alter_table("benchmarks", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True)
        )
        batch_op.add_column(
            sa.Column("baseline_model", sa.String(length=100), nullable=True)
        )
        # NOT NULL with default 1 — every benchmark runs at least once
        batch_op.add_column(
            sa.Column(
                "repeats",
                sa.Integer(),
                nullable=False,
                server_default="1",
            )
        )

    # ------------------------------------------------------------------
    # 3. projects — make system_prompt NOT NULL, add JSON columns
    # ------------------------------------------------------------------
    with op.batch_alter_table("projects", schema=None) as batch_op:
        # Backfill any NULL system_prompt rows with empty string before
        # enforcing the NOT NULL constraint (batch recreates the table).
        batch_op.alter_column(
            "system_prompt",
            existing_type=sa.Text(),
            type_=sa.Text(),
            existing_nullable=True,
            nullable=False,
            server_default="",
        )
        batch_op.add_column(sa.Column("output_schema", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("rubric", sa.JSON(), nullable=True))

    # ------------------------------------------------------------------
    # 4. test_cases — evaluation_criteria Text → JSON
    #
    # SQLite batch_alter_table recreates the table, so the column type
    # change is applied cleanly. Existing text values cannot be cast to
    # JSON by the DB engine; they are coerced to NULL by SQLite (which
    # stores JSON as TEXT internally — the type is advisory in SQLite).
    # On PostgreSQL the column would need an explicit USING cast.
    # ------------------------------------------------------------------
    with op.batch_alter_table("test_cases", schema=None) as batch_op:
        batch_op.alter_column(
            "expected_behavior",
            existing_type=sa.Text(),
            type_=sa.Text(),
            existing_nullable=True,
            nullable=False,
        )
        batch_op.alter_column(
            "evaluation_criteria",
            existing_type=sa.Text(),
            type_=sa.JSON(),
            existing_nullable=True,
            nullable=True,
        )

    # ------------------------------------------------------------------
    # 5. evaluation_attempts — new table
    # ------------------------------------------------------------------
    op.create_table(
        "evaluation_attempts",
        sa.Column("evaluation_id", sa.String(length=36), nullable=False),
        sa.Column("attempt_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("input_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("latency_ms", sa.Float(), nullable=False, server_default="0"),
        sa.Column(
            "execution_cost",
            sa.Numeric(12, 8),
            nullable=False,
            server_default="0",
        ),
        sa.Column("error_type", sa.String(length=32), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["evaluation_id"],
            ["evaluations.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("evaluation_attempts", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_evaluation_attempts_id"), ["id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_evaluation_attempts_evaluation_id"),
            ["evaluation_id"],
            unique=False,
        )


# ---------------------------------------------------------------------------
# Downgrade
# ---------------------------------------------------------------------------

def downgrade() -> None:
    """Reverse all changes introduced by this migration."""

    # ------------------------------------------------------------------
    # 5. Drop evaluation_attempts
    # ------------------------------------------------------------------
    with op.batch_alter_table("evaluation_attempts", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_evaluation_attempts_evaluation_id"))
        batch_op.drop_index(batch_op.f("ix_evaluation_attempts_id"))
    op.drop_table("evaluation_attempts")

    # ------------------------------------------------------------------
    # 4. test_cases — revert evaluation_criteria JSON → Text
    # ------------------------------------------------------------------
    with op.batch_alter_table("test_cases", schema=None) as batch_op:
        batch_op.alter_column(
            "evaluation_criteria",
            existing_type=sa.JSON(),
            type_=sa.Text(),
            existing_nullable=True,
            nullable=True,
        )

    # ------------------------------------------------------------------
    # 3. projects — revert system_prompt to nullable, drop JSON cols
    # ------------------------------------------------------------------
    with op.batch_alter_table("projects", schema=None) as batch_op:
        batch_op.drop_column("rubric")
        batch_op.drop_column("output_schema")
        batch_op.alter_column(
            "system_prompt",
            existing_type=sa.Text(),
            type_=sa.Text(),
            existing_nullable=False,
            nullable=True,
            server_default=None,
        )

    # ------------------------------------------------------------------
    # 2. benchmarks — drop additive columns
    # ------------------------------------------------------------------
    with op.batch_alter_table("benchmarks", schema=None) as batch_op:
        batch_op.drop_column("repeats")
        batch_op.drop_column("baseline_model")
        batch_op.drop_column("completed_at")

    # ------------------------------------------------------------------
    # 1. evaluations — revert renames and drop additive columns
    # ------------------------------------------------------------------
    with op.batch_alter_table("evaluations", schema=None) as batch_op:
        # Drop additive columns first
        batch_op.drop_column("judge_reasoning")
        batch_op.drop_column("prompt_version")
        batch_op.drop_column("repeat_index")
        batch_op.drop_column("attempt_count")
        # Revert quality_score → judge_score
        batch_op.alter_column(
            "quality_score",
            new_column_name="judge_score",
            existing_type=sa.Float(),
            type_=sa.Float(),
            existing_nullable=True,
            nullable=True,
        )
        # Revert latency_ms to nullable
        batch_op.alter_column(
            "latency_ms",
            existing_type=sa.Float(),
            type_=sa.Float(),
            existing_nullable=False,
            nullable=True,
            server_default=None,
        )
        # Revert execution_cost → total_cost (Numeric → Float, back to nullable)
        batch_op.alter_column(
            "execution_cost",
            new_column_name="total_cost",
            existing_type=sa.Numeric(12, 8),
            type_=sa.Float(),
            existing_nullable=False,
            nullable=True,
            server_default=None,
        )
        # Revert output_tokens → completion_tokens
        batch_op.alter_column(
            "output_tokens",
            new_column_name="completion_tokens",
            existing_type=sa.Integer(),
            type_=sa.Integer(),
            existing_nullable=False,
            nullable=True,
            server_default=None,
        )
        # Revert input_tokens → prompt_tokens
        batch_op.alter_column(
            "input_tokens",
            new_column_name="prompt_tokens",
            existing_type=sa.Integer(),
            type_=sa.Integer(),
            existing_nullable=False,
            nullable=True,
            server_default=None,
        )
