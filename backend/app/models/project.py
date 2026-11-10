from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.benchmark import Benchmark
    from app.models.test_case import TestCase


class Project(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Represents a business use case being benchmarked and evaluated."""

    __tablename__ = "projects"

    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    business_domain: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    system_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    benchmarks: Mapped[List["Benchmark"]] = relationship(
        "Benchmark",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="Benchmark.created_at.desc()",
    )
    test_cases: Mapped[List["TestCase"]] = relationship(
        "TestCase",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="TestCase.created_at.desc()",
    )

    def __repr__(self) -> str:
        return f"<Project(id={self.id}, name='{self.name}', domain='{self.business_domain}')>"
