from datetime import datetime
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.evaluation import Evaluation
    from app.models.project import Project


class Benchmark(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Represents a benchmark execution configuration and state for a project."""

    __tablename__ = "benchmarks"

    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    selected_models: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    status: Mapped[str] = mapped_column(
        String(50),
        default="pending",
        nullable=False,
        index=True,
    )
    # Distinguishes simulated benchmark runs from provider-backed live runs.
    is_mock: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)

    # --- Additive benchmark configuration columns ---
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    baseline_model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    # NOT NULL with default 1 — every benchmark runs at least once
    repeats: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="benchmarks")
    evaluations: Mapped[List["Evaluation"]] = relationship(
        "Evaluation",
        back_populates="benchmark",
        cascade="all, delete-orphan",
        order_by="Evaluation.created_at.desc()",
    )

    def __repr__(self) -> str:
        return f"<Benchmark(id={self.id}, name='{self.name}', status='{self.status}')>"
