import math
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.evaluation import Evaluation
from app.schemas.reports import (
    CostMetrics,
    LatencyMetrics,
    ModelAggregateMetrics,
    QualityMetrics,
    ReliabilityMetrics,
    TokenMetrics,
)


class AggregationService:
    """Benchmark Aggregation Engine computing reliability, latency, token, cost, and quality metrics."""

    @staticmethod
    def calculate_percentile(values: List[float], percentile: float) -> float:
        """Calculate percentile with linear interpolation, safe for small sample sizes."""
        if not values:
            return 0.0
        if len(values) == 1:
            return float(values[0])

        sorted_vals = sorted(values)
        k = (len(sorted_vals) - 1) * (percentile / 100.0)
        floor_idx = math.floor(k)
        ceil_idx = math.ceil(k)

        if floor_idx == ceil_idx:
            return float(sorted_vals[int(k)])

        d0 = sorted_vals[floor_idx] * (ceil_idx - k)
        d1 = sorted_vals[ceil_idx] * (k - floor_idx)
        return float(round(d0 + d1, 3))

    @classmethod
    def compute_metrics_for_evaluations(
        cls,
        evaluations: List[Evaluation],
    ) -> Dict[str, Any]:
        """Compute aggregated metrics dictionary from a list of Evaluation models."""
        total_evals = len(evaluations)
        if total_evals == 0:
            return {
                "reliability": ReliabilityMetrics(),
                "performance": LatencyMetrics(),
                "token_usage": TokenMetrics(),
                "financial": CostMetrics(),
                "quality": QualityMetrics(),
            }

        successful = [e for e in evaluations if e.status in ("completed", "success")]
        failed = [e for e in evaluations if e.status == "failed"]
        num_successful = len(successful)
        num_failed = len(failed)

        success_rate = round(num_successful / total_evals, 4)
        total_attempts = sum(e.attempt_count for e in evaluations)
        retried_evals = sum(1 for e in evaluations if e.attempt_count > 1)
        retry_rate = round(retried_evals / total_evals, 4)

        reliability = ReliabilityMetrics(
            total_evaluations=total_evals,
            successful_evaluations=num_successful,
            failed_evaluations=num_failed,
            success_rate=success_rate,
            attempt_counts=total_attempts,
            retry_rate=retry_rate,
        )

        # Latencies
        latencies = [e.latency_ms for e in evaluations if e.latency_ms is not None]
        if latencies:
            avg_lat = round(sum(latencies) / len(latencies), 2)
            min_lat = round(min(latencies), 2)
            max_lat = round(max(latencies), 2)
            p50_lat = cls.calculate_percentile(latencies, 50.0)
            p95_lat = cls.calculate_percentile(latencies, 95.0)
        else:
            avg_lat = min_lat = max_lat = p50_lat = p95_lat = 0.0

        performance = LatencyMetrics(
            average_latency=avg_lat,
            minimum_latency=min_lat,
            maximum_latency=max_lat,
            p50_latency=p50_lat,
            p95_latency=p95_lat,
        )

        # Token usage
        in_tokens = [e.input_tokens for e in evaluations if e.input_tokens is not None]
        out_tokens = [e.output_tokens for e in evaluations if e.output_tokens is not None]

        tot_in = sum(in_tokens)
        tot_out = sum(out_tokens)
        avg_in = round(tot_in / total_evals, 2)
        avg_out = round(tot_out / total_evals, 2)

        token_usage = TokenMetrics(
            total_input_tokens=tot_in,
            total_output_tokens=tot_out,
            average_input_tokens=avg_in,
            average_output_tokens=avg_out,
        )

        # Financial costs
        costs = [float(e.execution_cost) for e in evaluations if e.execution_cost is not None]
        tot_cost = round(sum(costs), 6)
        avg_cost = round(tot_cost / total_evals, 6)
        cost_per_succ = round(tot_cost / num_successful, 6) if num_successful > 0 else 0.0

        financial = CostMetrics(
            total_execution_cost=tot_cost,
            average_cost_per_evaluation=avg_cost,
            cost_per_successful_evaluation=cost_per_succ,
        )

        # Quality
        quality_scores = [e.quality_score for e in evaluations if e.quality_score is not None]
        if quality_scores:
            avg_qual = round(sum(quality_scores) / len(quality_scores), 2)
            min_qual = round(min(quality_scores), 2)
            max_qual = round(max(quality_scores), 2)
            qual_rate = round(len(quality_scores) / total_evals, 4)
            sample_cnt = len(quality_scores)
        else:
            avg_qual = min_qual = max_qual = None
            qual_rate = 0.0
            sample_cnt = 0

        quality = QualityMetrics(
            average_judge_score=avg_qual,
            minimum_judge_score=min_qual,
            maximum_judge_score=max_qual,
            judge_completion_rate=qual_rate,
            sample_count=sample_cnt,
        )

        return {
            "reliability": reliability,
            "performance": performance,
            "token_usage": token_usage,
            "financial": financial,
            "quality": quality,
        }

    @classmethod
    def aggregate_benchmark_evaluations(
        cls,
        evaluations: List[Evaluation],
    ) -> Dict[str, Any]:
        """Aggregate evaluations grouped by model and overall suite."""
        # Group by model_name
        grouped_by_model: Dict[str, List[Evaluation]] = {}
        for ev in evaluations:
            grouped_by_model.setdefault(ev.model_name, []).append(ev)

        model_metrics: Dict[str, ModelAggregateMetrics] = {}
        for model_name, ev_list in grouped_by_model.items():
            provider_name = ev_list[0].provider_name if ev_list else "unknown"
            metrics = cls.compute_metrics_for_evaluations(ev_list)

            model_metrics[model_name] = ModelAggregateMetrics(
                model_name=model_name,
                provider_name=provider_name,
                sample_count=len(ev_list),
                reliability=metrics["reliability"],
                performance=metrics["performance"],
                token_usage=metrics["token_usage"],
                financial=metrics["financial"],
                quality=metrics["quality"],
            )

        overall = cls.compute_metrics_for_evaluations(evaluations)

        return {
            "model_metrics": model_metrics,
            "overall_reliability": overall["reliability"],
            "overall_performance": overall["performance"],
            "overall_token_usage": overall["token_usage"],
            "overall_financial": overall["financial"],
            "overall_quality": overall["quality"],
        }

    @classmethod
    def get_aggregated_benchmark_results(
        cls,
        db: Session,
        benchmark_id: str,
        test_case_id: Optional[str] = None,
        exclude_mock: bool = False,
    ) -> Dict[str, Any]:
        """Fetch and aggregate evaluations for a benchmark directly from the database.

        If exclude_mock is True, filters out mock evaluations via SQL column if present,
        or via response signature heuristic if schema migration is pending.
        """
        query = select(Evaluation).where(Evaluation.benchmark_id == benchmark_id)
        if test_case_id:
            query = query.where(Evaluation.test_case_id == test_case_id)
        if exclude_mock and hasattr(Evaluation, "is_mock"):
            query = query.where(Evaluation.is_mock == False)

        evaluations = list(db.scalars(query).all())

        if exclude_mock and not hasattr(Evaluation, "is_mock"):
            # Application-level mock filtering fallback
            evaluations = [
                e for e in evaluations
                if not (e.response_text and e.response_text.startswith("[MOCK"))
            ]

        return cls.aggregate_benchmark_evaluations(evaluations)
