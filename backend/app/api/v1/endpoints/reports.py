from typing import Any, Dict
from fastapi import APIRouter, Query
from app.services.roi_service import ROIService

router = APIRouter()


@router.get(
    "/roi/{benchmark_id}",
    summary="Get ROI Model Recommendation",
    response_model=Dict[str, Any],
)
def get_roi_recommendation(
    benchmark_id: str,
    monthly_volume: int = Query(100_000, ge=100, description="Projected monthly request volume"),
) -> Dict[str, Any]:
    """Retrieve cost/quality ROI recommendations and model selection insights."""
    # Placeholder integration with ROIService
    return {
        "benchmark_id": benchmark_id,
        "monthly_volume": monthly_volume,
        "recommendation": ROIService.generate_recommendation(
            benchmark_results=[],
            project_monthly_volume=monthly_volume,
        ),
    }
