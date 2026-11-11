from decimal import Decimal
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import Boolean, Float, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.benchmark import Benchmark
    from app.models.evaluation_attempt import EvaluationAttempt
    from app.models.test_case import TestCase


class Evaluation(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Represents an evaluation result of an individual test case on a specific model."""

    __tablename__ = "evaluations"

    benchmark_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("benchmarks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # SET NULL so evaluations survive test case deletion; test_case_id becomes NULL
    test_case_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("test_cases.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    provider_name: Mapped[str] = mapped_column(String(50), nullable=False)

    # --- Contract-compliant metric columns ---
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    execution_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 8), nullable=False, default=Decimal("0")
    )
    latency_ms: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    quality_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    response_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="completed", nullable=False)
    # Enables SQL-level exclusion of simulated data from live analytics.
    is_mock: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)

    # --- Additive tracking columns (NOT NULL with meaningful defaults) ---
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    repeat_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    prompt_version: Mapped[str] = mapped_column(
        String(64), nullable=False, default="original"
    )
    # Nullable — only populated when LLM-as-a-Judge runs
    judge_reasoning: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    benchmark: Mapped["Benchmark"] = relationship("Benchmark", back_populates="evaluations")
    test_case: Mapped[Optional["TestCase"]] = relationship("TestCase", back_populates="evaluations")
    attempts: Mapped[List["EvaluationAttempt"]] = relationship(
        "EvaluationAttempt",
        back_populates="evaluation",
        cascade="all, delete-orphan",
        order_by="EvaluationAttempt.attempt_number",
    )

    def __repr__(self) -> str:
        return f"<Evaluation(id={self.id}, model='{self.model_name}', status='{self.status}')>"
