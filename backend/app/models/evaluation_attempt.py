from decimal import Decimal
from typing import TYPE_CHECKING, Optional
from sqlalchemy import Boolean, Float, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.evaluation import Evaluation


class EvaluationAttempt(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """One row per LLM call, including retries. Makes hidden retry cost visible."""

    __tablename__ = "evaluation_attempts"

    evaluation_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("evaluations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    latency_ms: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    execution_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 8), nullable=False, default=Decimal("0")
    )
    # Enables SQL-level exclusion of simulated attempt records from live analytics
    is_mock: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)

    # none | json_parse | schema | assertion | api_error | timeout
    error_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    evaluation: Mapped["Evaluation"] = relationship("Evaluation", back_populates="attempts")