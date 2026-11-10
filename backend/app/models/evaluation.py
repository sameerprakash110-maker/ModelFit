from typing import TYPE_CHECKING, Optional
from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.benchmark import Benchmark
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
    test_case_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("test_cases.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    provider_name: Mapped[str] = mapped_column(String(50), nullable=False)

    prompt_tokens: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    completion_tokens: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    total_cost: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    latency_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    judge_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    response_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="completed", nullable=False)

    # Relationships
    benchmark: Mapped["Benchmark"] = relationship("Benchmark", back_populates="evaluations")
    test_case: Mapped[Optional["TestCase"]] = relationship("TestCase", back_populates="evaluations")

    def __repr__(self) -> str:
        return f"<Evaluation(id={self.id}, model='{self.model_name}', status='{self.status}')>"
