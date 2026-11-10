from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.benchmark import BenchmarkCreate, BenchmarkResponse, BenchmarkUpdate
from app.services.benchmark_service import BenchmarkService

router = APIRouter()


@router.post(
    "",
    response_model=BenchmarkResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new benchmark",
)
def create_benchmark(
    benchmark_in: BenchmarkCreate,
    db: Session = Depends(get_db),
) -> BenchmarkResponse:
    """Create and persist a new benchmark run configuration."""
    return BenchmarkService.create_benchmark(db, benchmark_in)


@router.get(
    "",
    response_model=List[BenchmarkResponse],
    summary="List benchmarks",
)
def list_benchmarks(
    project_id: Optional[str] = Query(None, description="Filter benchmarks by project UUID"),
    skip: int = Query(0, ge=0, description="Pagination skip offset"),
    limit: int = Query(100, ge=1, le=500, description="Max benchmarks to return"),
    db: Session = Depends(get_db),
) -> List[BenchmarkResponse]:
    """Retrieve benchmarks, optionally filtered by project."""
    return BenchmarkService.get_benchmarks(db, project_id=project_id, skip=skip, limit=limit)


@router.get(
    "/{benchmark_id}",
    response_model=BenchmarkResponse,
    summary="Get benchmark by ID",
)
def get_benchmark(
    benchmark_id: str,
    db: Session = Depends(get_db),
) -> BenchmarkResponse:
    """Retrieve details and execution status for a specific benchmark."""
    return BenchmarkService.get_benchmark_or_404(db, benchmark_id)


@router.patch(
    "/{benchmark_id}",
    response_model=BenchmarkResponse,
    summary="Update benchmark status or metadata",
)
def update_benchmark(
    benchmark_id: str,
    benchmark_in: BenchmarkUpdate,
    db: Session = Depends(get_db),
) -> BenchmarkResponse:
    """Update status (e.g. pending, running, completed, failed) or metadata of a benchmark."""
    return BenchmarkService.update_benchmark(db, benchmark_id, benchmark_in)
