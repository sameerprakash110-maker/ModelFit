from typing import TYPE_CHECKING, Any, Dict, List, Optional
from sqlalchemy import JSON, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.evaluation import Evaluation
    from app.models.project import Project


class TestCase(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Represents an evaluation workload / prompt test case for a project."""

    __tablename__ = "test_cases"

    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    input_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    expected_behavior: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # JSON per database contract — stores structured scoring criteria
    evaluation_criteria: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="test_cases")
    evaluations: Mapped[List["Evaluation"]] = relationship(
        "Evaluation",
        back_populates="test_case",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<TestCase(id={self.id}, project_id='{self.project_id}')>"
