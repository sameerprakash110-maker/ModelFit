from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ReliabilityMetrics(BaseModel):
    """Reliability indicators for a model or benchmark suite."""

    total_evaluations: int = Field(0, description="Total evaluations attempted")
    successful_evaluations: int = Field(0, description="Total successful evaluations")
    failed_evaluations: int = Field(0, description="Total failed evaluations")
    success_rate: float = Field(0.0, description="Proportion of successful evaluations (0.0 to 1.0)")
    attempt_counts: int = Field(0, description="Total LLM calls including retries")
    retry_rate: float = Field(0.0, description="Proportion of evaluations requiring retry attempts")


class LatencyMetrics(BaseModel):
    """Latency performance indicators in milliseconds."""

    average_latency: float = Field(0.0, description="Mean latency in ms")
    minimum_latency: float = Field(0.0, description="Minimum observed latency in ms")
    maximum_latency: float = Field(0.0, description="Maximum observed latency in ms")
    p50_latency: float = Field(0.0, description="50th percentile (median) latency in ms")
    p95_latency: float = Field(0.0, description="95th percentile latency in ms")


class TokenMetrics(BaseModel):
    """Token consumption metrics."""

    total_input_tokens: int = Field(0, description="Total prompt/input tokens")
    total_output_tokens: int = Field(0, description="Total completion/output tokens")
    average_input_tokens: float = Field(0.0, description="Average prompt tokens per evaluation")
    average_output_tokens: float = Field(0.0, description="Average completion tokens per evaluation")


class CostMetrics(BaseModel):
    """Monetary cost calculations in USD."""

    total_execution_cost: float = Field(0.0, description="Total USD expenditure across all calls")
    average_cost_per_evaluation: float = Field(0.0, description="Average USD cost per evaluation")
    cost_per_successful_evaluation: float = Field(0.0, description="Cost per successful evaluation")


class QualityMetrics(BaseModel):
    """Qualitative scoring metrics from LLM-as-a-Judge."""

    average_judge_score: Optional[float] = Field(None, description="Average judge score (0.0 - 10.0)")
    minimum_judge_score: Optional[float] = Field(None, description="Minimum judge score observed")
    maximum_judge_score: Optional[float] = Field(None, description="Maximum judge score observed")
    judge_completion_rate: float = Field(0.0, description="Proportion of evaluations successfully judged")
    sample_count: int = Field(0, description="Number of evaluations scored by the judge")


class ModelAggregateMetrics(BaseModel):
    """Aggregated performance, reliability, quality, and cost metrics for an individual model."""

    model_name: str
    provider_name: str
    sample_count: int
    reliability: ReliabilityMetrics
    performance: LatencyMetrics
    token_usage: TokenMetrics
    financial: CostMetrics
    quality: QualityMetrics


class ROIRecommendation(BaseModel):
    """Cost/benefit recommendation based on empirical benchmark evaluation."""

    category: str = Field(..., description="Recommendation tier (best_quality, lowest_cost, best_value, fastest, no_eligible_model)")
    recommended_primary_model: Optional[str] = Field(None, description="Recommended primary model")
    recommended_fallback_model: Optional[str] = Field(None, description="Recommended fallback model for resiliency")
    monthly_volume: int = Field(..., description="Projected monthly request volume")
    estimated_monthly_cost_usd: float = Field(..., description="Projected monthly expenditure with recommended model")
    estimated_premium_cost_usd: float = Field(..., description="Projected monthly expenditure with baseline/premium model")
    estimated_savings_usd: float = Field(..., description="Projected dollar savings per month")
    savings_percentage: float = Field(..., description="Projected cost reduction percentage")
    cost_per_successful_request: float = Field(..., description="Observed cost per successful request")
    rationale: str = Field(..., description="Actionable rationale explaining the selection")
    eligible_models: List[str] = Field(default_factory=list, description="Models meeting quality & reliability thresholds")
    ineligible_reasons: Dict[str, str] = Field(default_factory=dict, description="Reasons disqualifying non-selected models")


class BenchmarkSummaryResponse(BaseModel):
    """High-level summary of benchmark execution."""

    benchmark_id: str
    project_id: str
    name: str
    status: str
    selected_models: List[str]
    baseline_model: Optional[str] = None
    repeats: int
    completed_at: Optional[datetime] = None
    total_evaluations: int
    successful_evaluations: int
    failed_evaluations: int
    total_cost_usd: float
    model_summaries: Dict[str, Dict[str, Any]]


class BenchmarkReportResponse(BaseModel):
    """Comprehensive analytics and comparison report for a benchmark run."""

    benchmark_id: str
    project_id: str
    name: str
    description: Optional[str] = None
    status: str
    selected_models: List[str]
    baseline_model: Optional[str] = None
    repeats: int
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    model_metrics: Dict[str, ModelAggregateMetrics]
    overall_reliability: ReliabilityMetrics
    overall_performance: LatencyMetrics
    overall_token_usage: TokenMetrics
    overall_financial: CostMetrics
    overall_quality: QualityMetrics
    roi_recommendation: Optional[ROIRecommendation] = None


class ROIReportResponse(BaseModel):
    """Standalone ROI report for a benchmark run."""

    benchmark_id: str
    monthly_volume: int
    recommendation: ROIRecommendation
