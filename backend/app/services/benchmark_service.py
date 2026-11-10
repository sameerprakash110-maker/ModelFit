from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.exceptions import EntityNotFoundException, ValidationException
from app.models.benchmark import Benchmark
from app.models.project import Project
from app.schemas.benchmark import BenchmarkCreate, BenchmarkUpdate
from app.utils.logger import logger

VALID_STATUSES = {"pending", "running", "completed", "failed"}


class BenchmarkService:
    """Service layer managing benchmark lifecycle, configuration, and execution status."""

    @staticmethod
    def get_benchmarks(
        db: Session,
        project_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Benchmark]:
        """Fetch a paginated list of benchmarks, optionally filtered by project_id."""
        query = select(Benchmark).order_by(Benchmark.created_at.desc())
        if project_id:
            query = query.where(Benchmark.project_id == project_id)
        return list(db.scalars(query.offset(skip).limit(limit)).all())

    @staticmethod
    def get_benchmark_by_id(db: Session, benchmark_id: str) -> Optional[Benchmark]:
        """Fetch benchmark by ID."""
        query = select(Benchmark).where(Benchmark.id == benchmark_id)
        return db.scalars(query).first()

    @staticmethod
    def get_benchmark_or_404(db: Session, benchmark_id: str) -> Benchmark:
        """Fetch benchmark by ID or raise EntityNotFoundException."""
        benchmark = BenchmarkService.get_benchmark_by_id(db, benchmark_id)
        if not benchmark:
            raise EntityNotFoundException("Benchmark", benchmark_id)
        return benchmark

    @staticmethod
    def create_benchmark(db: Session, benchmark_in: BenchmarkCreate) -> Benchmark:
        """Create and persist a new benchmark for an existing project."""
        # Validate that project exists
        project = db.scalars(select(Project).where(Project.id == benchmark_in.project_id)).first()
        if not project:
            raise EntityNotFoundException("Project", benchmark_in.project_id)

        if not benchmark_in.selected_models:
            raise ValidationException("At least one model must be selected for benchmarking.")

        benchmark = Benchmark(
            project_id=benchmark_in.project_id,
            name=benchmark_in.name,
            description=benchmark_in.description,
            selected_models=benchmark_in.selected_models,
            status="pending",
        )
        db.add(benchmark)
        db.commit()
        db.refresh(benchmark)
        logger.info(f"Created benchmark: {benchmark.id} for project {benchmark.project_id}")
        return benchmark

    @staticmethod
    def update_benchmark(
        db: Session, benchmark_id: str, benchmark_in: BenchmarkUpdate
    ) -> Benchmark:
        """Update an existing benchmark's metadata or status."""
        benchmark = BenchmarkService.get_benchmark_or_404(db, benchmark_id)

        if benchmark_in.status is not None:
            if benchmark_in.status not in VALID_STATUSES:
                raise ValidationException(
                    f"Invalid status '{benchmark_in.status}'. Must be one of: {', '.join(VALID_STATUSES)}"
                )
            benchmark.status = benchmark_in.status

        if benchmark_in.name is not None:
            benchmark.name = benchmark_in.name
        if benchmark_in.description is not None:
            benchmark.description = benchmark_in.description

        db.add(benchmark)
        db.commit()
        db.refresh(benchmark)
        return benchmark
