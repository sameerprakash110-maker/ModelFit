from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.benchmark import (
    BenchmarkCreate,
    BenchmarkExecutionSummary,
    BenchmarkResponse,
    BenchmarkRunRequest,
    BenchmarkUpdate,
)
from app.schemas.reports import BenchmarkSummaryResponse
from app.services.aggregation_service import AggregationService
from app.services.benchmark_service import BenchmarkService
from app.services.evaluation_service import EvaluationService

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


@router.post(
    "/{benchmark_id}/run",
    response_model=BenchmarkExecutionSummary,
    summary="Execute a benchmark suite",
)
async def run_benchmark(
    benchmark_id: str,
    run_req: Optional[BenchmarkRunRequest] = None,
    db: Session = Depends(get_db),
) -> BenchmarkExecutionSummary:
    """Execute the benchmark matrix across selected models and project test cases."""
    req = run_req or BenchmarkRunRequest()
    return await BenchmarkService.run_benchmark(
        benchmark_id=benchmark_id,
        mock=req.mock,
        judge_enabled=req.judge_enabled,
        max_concurrency=req.max_concurrency,
        judge_provider=req.judge_provider,
        judge_model=req.judge_model,
        db=db,
    )


@router.post(
    "/{benchmark_id}/recover",
    response_model=BenchmarkResponse,
    summary="Recover an abandoned running benchmark",
)
def recover_benchmark(
    benchmark_id: str,
    force: bool = Query(False, description="Force recovery even if within active lease timeout"),
    lease_timeout_seconds: int = Query(300, description="Inactivity lease timeout in seconds"),
    db: Session = Depends(get_db),
) -> BenchmarkResponse:
    """Recover an abandoned benchmark stuck in running status after a crash or disconnection."""
    return BenchmarkService.recover_benchmark(
        db,
        benchmark_id,
        lease_timeout_seconds=lease_timeout_seconds,
        force=force,
    )


@router.get(
    "/{benchmark_id}/summary",
    response_model=BenchmarkSummaryResponse,
    summary="Get high-level benchmark execution summary",
)
def get_benchmark_summary(
    benchmark_id: str,
    db: Session = Depends(get_db),
) -> BenchmarkSummaryResponse:
    """Retrieve high-level summary and evaluation aggregates for a benchmark run."""
    benchmark = BenchmarkService.get_benchmark_or_404(db, benchmark_id)
    aggregates = AggregationService.get_aggregated_benchmark_results(db, benchmark_id)
    evaluations = EvaluationService.get_evaluations_for_benchmark(db, benchmark_id)
    is_mock = any(
        getattr(e, "is_mock", False) or (e.response_text and e.response_text.startswith("[MOCK"))
        for e in evaluations
    )

    model_summaries: Dict[str, Dict[str, Any]] = {}
    for model_name, m in aggregates["model_metrics"].items():
        model_summaries[model_name] = {
            "provider": m.provider_name,
            "sample_count": m.sample_count,
            "success_rate": m.reliability.success_rate,
            "avg_latency_ms": m.performance.average_latency,
            "total_cost_usd": m.financial.total_execution_cost,
            "avg_judge_score": m.quality.average_judge_score,
        }

    rel = aggregates["overall_reliability"]
    fin = aggregates["overall_financial"]

    return BenchmarkSummaryResponse(
        benchmark_id=benchmark.id,
        project_id=benchmark.project_id,
        name=benchmark.name,
        status=benchmark.status,
        selected_models=benchmark.selected_models,
        baseline_model=benchmark.baseline_model,
        repeats=benchmark.repeats,
        completed_at=benchmark.completed_at,
        is_mock=is_mock,
        total_evaluations=rel.total_evaluations,
        successful_evaluations=rel.successful_evaluations,
        failed_evaluations=rel.failed_evaluations,
        total_cost_usd=fin.total_execution_cost,
        model_summaries=model_summaries,
    )
