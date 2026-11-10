from decimal import Decimal
from app.models.evaluation import Evaluation
from app.services.aggregation_service import AggregationService


def _make_eval(
    model_name: str,
    provider_name: str,
    status: str = "completed",
    latency_ms: float = 100.0,
    cost: float = 0.0001,
    in_tokens: int = 50,
    out_tokens: int = 25,
    quality_score: float | None = 8.0,
    attempts: int = 1,
) -> Evaluation:
    return Evaluation(
        id=f"eval-{model_name}-{latency_ms}",
        benchmark_id="bench-1",
        test_case_id="tc-1",
        model_name=model_name,
        provider_name=provider_name,
        status=status,
        latency_ms=latency_ms,
        execution_cost=Decimal(str(cost)),
        input_tokens=in_tokens,
        output_tokens=out_tokens,
        quality_score=quality_score,
        attempt_count=attempts,
    )


def test_percentile_small_samples():
    """Verify linear percentile interpolation works correctly on N=0, N=1, N=2, and N=5 datasets."""
    # N = 0
    assert AggregationService.calculate_percentile([], 50.0) == 0.0

    # N = 1
    assert AggregationService.calculate_percentile([100.0], 50.0) == 100.0
    assert AggregationService.calculate_percentile([100.0], 95.0) == 100.0

    # N = 2
    p50_two = AggregationService.calculate_percentile([100.0, 200.0], 50.0)
    assert p50_two == 150.0

    # N = 5
    vals = [10.0, 20.0, 30.0, 40.0, 50.0]
    assert AggregationService.calculate_percentile(vals, 50.0) == 30.0
    assert AggregationService.calculate_percentile(vals, 0.0) == 10.0
    assert AggregationService.calculate_percentile(vals, 100.0) == 50.0


def test_compute_metrics_empty_dataset():
    """Verify empty dataset yields safe zero-valued metrics without exceptions."""
    metrics = AggregationService.compute_metrics_for_evaluations([])
    assert metrics["reliability"].total_evaluations == 0
    assert metrics["reliability"].success_rate == 0.0
    assert metrics["performance"].average_latency == 0.0
    assert metrics["financial"].total_execution_cost == 0.0
    assert metrics["quality"].average_judge_score is None


def test_compute_metrics_all_failed():
    """Verify handling when all evaluations failed."""
    evals = [
        _make_eval("model-a", "prov-a", status="failed", cost=0.0001, quality_score=None),
        _make_eval("model-a", "prov-a", status="failed", cost=0.0001, quality_score=None),
    ]
    metrics = AggregationService.compute_metrics_for_evaluations(evals)
    assert metrics["reliability"].total_evaluations == 2
    assert metrics["reliability"].successful_evaluations == 0
    assert metrics["reliability"].failed_evaluations == 2
    assert metrics["reliability"].success_rate == 0.0
    assert metrics["financial"].cost_per_successful_evaluation == 0.0
    assert metrics["quality"].sample_count == 0


def test_aggregate_benchmark_evaluations_multi_model():
    """Verify aggregation correctly groups metrics by model and computes overall suite totals."""
    evals = [
        # Model A: 2 completed
        _make_eval("model-a", "prov-1", status="completed", latency_ms=100.0, cost=0.001, quality_score=8.0),
        _make_eval("model-a", "prov-1", status="completed", latency_ms=200.0, cost=0.002, quality_score=9.0),
        # Model B: 1 completed, 1 failed
        _make_eval("model-b", "prov-2", status="completed", latency_ms=50.0, cost=0.0005, quality_score=7.0),
        _make_eval("model-b", "prov-2", status="failed", latency_ms=60.0, cost=0.0001, quality_score=None),
    ]

    agg = AggregationService.aggregate_benchmark_evaluations(evals)

    # Model A metrics
    model_a = agg["model_metrics"]["model-a"]
    assert model_a.sample_count == 2
    assert model_a.reliability.success_rate == 1.0
    assert model_a.performance.average_latency == 150.0
    assert model_a.quality.average_judge_score == 8.5
    assert model_a.financial.total_execution_cost == 0.003

    # Model B metrics
    model_b = agg["model_metrics"]["model-b"]
    assert model_b.sample_count == 2
    assert model_b.reliability.success_rate == 0.5
    assert model_b.quality.average_judge_score == 7.0
    assert model_b.financial.cost_per_successful_evaluation == 0.0006

    # Overall suite
    assert agg["overall_reliability"].total_evaluations == 4
    assert agg["overall_reliability"].successful_evaluations == 3
    assert agg["overall_reliability"].failed_evaluations == 1
    assert agg["overall_reliability"].success_rate == 0.75
    assert agg["overall_quality"].sample_count == 3
    assert agg["overall_quality"].average_judge_score == round((8.0 + 9.0 + 7.0) / 3, 2)
