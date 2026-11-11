from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.auth import get_current_active_user
from app.core.database import get_db
from app.schemas.auth import UserResponse
from app.schemas.reports import BenchmarkReportResponse, ROIReportResponse
from app.services.aggregation_service import AggregationService
from app.services.benchmark_service import BenchmarkService
from app.services.evaluation_service import EvaluationService
from app.services.ownership_service import OwnershipService
from app.services.roi_service import ROIService

router = APIRouter()


@router.get(
    "/benchmark/{benchmark_id}",
    summary="Get comprehensive benchmark evaluation report",
    response_model=BenchmarkReportResponse,
)
def get_benchmark_report(
    benchmark_id: str,
    monthly_volume: int = Query(100_000, ge=100, description="Projected monthly request volume"),
    target_category: str = Query("best_value", description="Target ROI category (best_value, best_quality, lowest_cost, fastest)"),
    exclude_mock: bool = Query(False, description="Exclude mock simulation evaluations from report analytics"),
    current_user: UserResponse = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> BenchmarkReportResponse:
    """Retrieve detailed analytics, reliability, latency, token consumption, quality scores, and ROI insights, verifying ownership."""
    benchmark = OwnershipService.verify_benchmark_access(db, benchmark_id, current_user.id)
    aggregates = AggregationService.get_aggregated_benchmark_results(
        db, benchmark_id, exclude_mock=exclude_mock
    )
    evaluations = EvaluationService.get_evaluations_for_benchmark(db, benchmark_id)
    is_mock = any(
        getattr(e, "is_mock", False) or (e.response_text and e.response_text.startswith("[MOCK"))
        for e in evaluations
    )

    # Compute ROI recommendation based on empirical results
    roi_rec = ROIService.generate_recommendation_from_metrics(
        model_metrics=aggregates["model_metrics"],
        baseline_model_name=benchmark.baseline_model,
        monthly_volume=monthly_volume,
        target_category=target_category,
    )

    return BenchmarkReportResponse(
        benchmark_id=benchmark.id,
        project_id=benchmark.project_id,
        name=benchmark.name,
        description=benchmark.description,
        status=benchmark.status,
        selected_models=benchmark.selected_models,
        baseline_model=benchmark.baseline_model,
        repeats=benchmark.repeats,
        completed_at=benchmark.completed_at,
        is_mock=is_mock,
        created_at=benchmark.created_at,
        updated_at=benchmark.updated_at,
        model_metrics=aggregates["model_metrics"],
        overall_reliability=aggregates["overall_reliability"],
        overall_performance=aggregates["overall_performance"],
        overall_token_usage=aggregates["overall_token_usage"],
        overall_financial=aggregates["overall_financial"],
        overall_quality=aggregates["overall_quality"],
        roi_recommendation=roi_rec,
    )


@router.get(
    "/roi/{benchmark_id}",
    summary="Get ROI model selection recommendations",
    response_model=ROIReportResponse,
)
def get_roi_recommendation(
    benchmark_id: str,
    monthly_volume: int = Query(100_000, ge=100, description="Projected monthly request volume"),
    target_category: str = Query("best_value", description="Target ROI category (best_value, best_quality, lowest_cost, fastest)"),
    exclude_mock: bool = Query(False, description="Exclude mock simulation evaluations from ROI calculation"),
    current_user: UserResponse = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> ROIReportResponse:
    """Retrieve data-backed cost vs quality ROI recommendations and projected savings, verifying ownership."""
    benchmark = OwnershipService.verify_benchmark_access(db, benchmark_id, current_user.id)
    aggregates = AggregationService.get_aggregated_benchmark_results(
        db, benchmark_id, exclude_mock=exclude_mock
    )
    evaluations = EvaluationService.get_evaluations_for_benchmark(db, benchmark_id)
    is_mock = any(
        getattr(e, "is_mock", False) or (e.response_text and e.response_text.startswith("[MOCK"))
        for e in evaluations
    )

    recommendation = ROIService.generate_recommendation_from_metrics(
        model_metrics=aggregates["model_metrics"],
        baseline_model_name=benchmark.baseline_model,
        monthly_volume=monthly_volume,
        target_category=target_category,
    )

    return ROIReportResponse(
        benchmark_id=benchmark.id,
        monthly_volume=monthly_volume,
        is_mock=is_mock,
        recommendation=recommendation,
    )
