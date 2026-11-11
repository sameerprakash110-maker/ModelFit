from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class BenchmarkBase(BaseModel):
    """Base schema for benchmark runs."""

    name: str = Field(..., min_length=1, max_length=255, description="Benchmark name")
    description: Optional[str] = Field(None, description="Benchmark description")
    selected_models: List[str] = Field(
        ...,
        min_length=1,
        description="List of model identifiers to benchmark (e.g. ['gemini-3.1-flash-lite', 'gpt-4o'])",
    )
    baseline_model: Optional[str] = Field(
        None, max_length=100, description="Baseline model identifier for comparison"
    )
    repeats: int = Field(1, ge=1, le=10, description="Number of execution repeats per test case")


class BenchmarkCreate(BenchmarkBase):
    """Schema for creating a new benchmark run."""

    project_id: str = Field(..., description="ID of the project this benchmark belongs to")


class BenchmarkUpdate(BaseModel):
    """Schema for updating an existing benchmark."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[str] = Field(None, description="Execution status: pending, running, completed, failed")
    baseline_model: Optional[str] = None
    repeats: Optional[int] = Field(None, ge=1, le=10)


class BenchmarkResponse(BenchmarkBase):
    """Schema returned for a benchmark."""

    id: str
    project_id: str
    status: str
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BenchmarkRunRequest(BaseModel):
    """Parameters for initiating benchmark execution."""

    mock: bool = Field(False, description="Run in mock simulation mode without live API calls")
    judge_enabled: bool = Field(True, description="Enable LLM-as-a-Judge quality scoring")
    max_concurrency: int = Field(5, ge=1, le=20, description="Maximum concurrent evaluations")
    judge_provider: Optional[str] = Field(None, description="AI provider for judge (defaults to gemini)")
    judge_model: Optional[str] = Field(None, description="Specific model for judge evaluation")


class BenchmarkExecutionSummary(BaseModel):
    """Summary returned after executing a benchmark run."""

    benchmark_id: str
    status: str
    total_evaluations: int
    successful_evaluations: int
    failed_evaluations: int
    total_attempts: int
    total_cost_usd: float
    average_latency_ms: float
    average_quality_score: Optional[float] = None
    completed_at: Optional[datetime] = None
    is_mock: bool = Field(False, description="Whether execution was performed in mock simulation mode")
    message: str

    model_config = ConfigDict(from_attributes=True)
