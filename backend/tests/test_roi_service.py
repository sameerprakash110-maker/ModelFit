from app.schemas.reports import (
    CostMetrics,
    LatencyMetrics,
    ModelAggregateMetrics,
    QualityMetrics,
    ReliabilityMetrics,
    TokenMetrics,
)
from app.services.roi_service import ROIService


def _build_model_metrics(
    model_name: str,
    success_rate: float = 1.0,
    quality_score: float = 8.5,
    cost_per_succ: float = 0.0002,
    latency: float = 150.0,
) -> ModelAggregateMetrics:
    return ModelAggregateMetrics(
        model_name=model_name,
        provider_name="test-provider",
        sample_count=10,
        reliability=ReliabilityMetrics(
            total_evaluations=10,
            successful_evaluations=int(10 * success_rate),
            failed_evaluations=10 - int(10 * success_rate),
            success_rate=success_rate,
            attempt_counts=10,
            retry_rate=0.0,
        ),
        performance=LatencyMetrics(
            average_latency=latency,
            minimum_latency=latency,
            maximum_latency=latency,
            p50_latency=latency,
            p95_latency=latency,
        ),
        token_usage=TokenMetrics(
            total_input_tokens=1000,
            total_output_tokens=500,
            average_input_tokens=100.0,
            average_output_tokens=50.0,
        ),
        financial=CostMetrics(
            total_execution_cost=cost_per_succ * 10,
            average_cost_per_evaluation=cost_per_succ,
            cost_per_successful_evaluation=cost_per_succ,
        ),
        quality=QualityMetrics(
            average_judge_score=quality_score,
            minimum_judge_score=quality_score,
            maximum_judge_score=quality_score,
            judge_completion_rate=1.0,
            sample_count=10,
        ),
    )


def test_roi_empty_metrics():
    """Verify empty input returns no_eligible_model category."""
    rec = ROIService.generate_recommendation_from_metrics({})
    assert rec.category == "no_eligible_model"
    assert rec.recommended_primary_model is None
    assert rec.estimated_savings_usd == 0.0


def test_roi_disqualification_due_to_reliability():
    """Verify model with success rate below 90% is disqualified."""
    metrics = {
        "unreliable-model": _build_model_metrics("unreliable-model", success_rate=0.80, quality_score=9.5),
    }
    rec = ROIService.generate_recommendation_from_metrics(metrics)
    assert rec.category == "no_eligible_model"
    assert "unreliable-model" in rec.ineligible_reasons
    assert "Reliability" in rec.ineligible_reasons["unreliable-model"]


def test_roi_disqualification_due_to_absolute_quality():
    """Verify model with quality score below 6.0 is disqualified."""
    metrics = {
        "poor-quality-model": _build_model_metrics("poor-quality-model", quality_score=5.2),
    }
    rec = ROIService.generate_recommendation_from_metrics(metrics)
    assert rec.category == "no_eligible_model"
    assert "poor-quality-model" in rec.ineligible_reasons
    assert "below absolute threshold" in rec.ineligible_reasons["poor-quality-model"]


def test_roi_disqualification_due_to_relative_quality():
    """Verify model is disqualified if its quality is below 85% of top model."""
    metrics = {
        "top-model": _build_model_metrics("top-model", quality_score=9.5, cost_per_succ=0.005),
        "mediocre-model": _build_model_metrics("mediocre-model", quality_score=7.0, cost_per_succ=0.0001),  # 7.0 / 9.5 = 73.6% < 85%
    }
    rec = ROIService.generate_recommendation_from_metrics(metrics)
    assert "top-model" in rec.eligible_models
    assert "mediocre-model" not in rec.eligible_models
    assert "below relative threshold" in rec.ineligible_reasons["mediocre-model"]


def test_roi_categories_best_quality():
    """Verify best_quality category selects highest score model."""
    metrics = {
        "model-fast": _build_model_metrics("model-fast", quality_score=8.5, latency=50.0),
        "model-smart": _build_model_metrics("model-smart", quality_score=9.6, latency=400.0),
    }
    rec = ROIService.generate_recommendation_from_metrics(metrics, target_category="best_quality")
    assert rec.category == "best_quality"
    assert rec.recommended_primary_model == "model-smart"


def test_roi_categories_lowest_cost():
    """Verify lowest_cost category selects cheapest eligible model."""
    metrics = {
        "model-expensive": _build_model_metrics("model-expensive", quality_score=9.0, cost_per_succ=0.005),
        "model-cheap": _build_model_metrics("model-cheap", quality_score=8.8, cost_per_succ=0.0001),
    }
    rec = ROIService.generate_recommendation_from_metrics(metrics, target_category="lowest_cost")
    assert rec.category == "lowest_cost"
    assert rec.recommended_primary_model == "model-cheap"


def test_roi_categories_fastest():
    """Verify fastest category selects lowest latency eligible model."""
    metrics = {
        "model-slow": _build_model_metrics("model-slow", quality_score=9.0, latency=300.0),
        "model-quick": _build_model_metrics("model-quick", quality_score=8.7, latency=65.0),
    }
    rec = ROIService.generate_recommendation_from_metrics(metrics, target_category="fastest")
    assert rec.category == "fastest"
    assert rec.recommended_primary_model == "model-quick"


def test_roi_fallback_model_selection():
    """Verify a distinct fallback model is selected for high resiliency."""
    metrics = {
        "primary": _build_model_metrics("primary", quality_score=8.5, cost_per_succ=0.0001),
        "backup": _build_model_metrics("backup", quality_score=9.2, cost_per_succ=0.001),
    }
    rec = ROIService.generate_recommendation_from_metrics(metrics, target_category="lowest_cost")
    assert rec.recommended_primary_model == "primary"
    assert rec.recommended_fallback_model == "backup"


def test_roi_monthly_cost_and_savings_calculation():
    """Verify monthly cost, baseline premium spend, and savings calculations."""
    # Premium baseline: $0.005 / req. Primary selected: $0.0005 / req.
    # Volume: 100,000 reqs.
    # Primary cost = $50. Premium baseline = $500. Savings = $450 (90%).
    metrics = {
        "gpt-4o": _build_model_metrics("gpt-4o", quality_score=9.5, cost_per_succ=0.005),
        "gemini-3.1-flash-lite": _build_model_metrics("gemini-3.1-flash-lite", quality_score=8.8, cost_per_succ=0.0005),
    }

    rec = ROIService.generate_recommendation_from_metrics(
        metrics,
        baseline_model_name="gpt-4o",
        monthly_volume=100_000,
        target_category="lowest_cost",
    )

    assert rec.recommended_primary_model == "gemini-3.1-flash-lite"
    assert rec.estimated_monthly_cost_usd == 50.0
    assert rec.estimated_premium_cost_usd == 500.0
    assert rec.estimated_savings_usd == 450.0
    assert rec.savings_percentage == 90.0
