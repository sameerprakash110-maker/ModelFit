from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator


class EvaluationAttemptBase(BaseModel):
    """Base schema for an individual LLM invocation attempt."""

    attempt_number: int = Field(1, ge=1, description="Sequential attempt number (1-indexed)")
    input_tokens: int = Field(0, ge=0, description="Input/prompt tokens consumed in this attempt")
    output_tokens: int = Field(0, ge=0, description="Output/completion tokens generated in this attempt")
    latency_ms: float = Field(0.0, ge=0.0, description="Latency in milliseconds for this attempt")
    execution_cost: Decimal = Field(Decimal("0"), description="Cost in USD for this attempt")
    error_type: Optional[str] = Field(None, description="Error category if failed (timeout, api_error, etc.)")
    error_message: Optional[str] = Field(None, description="Detailed error description if failed")


class EvaluationAttemptCreate(EvaluationAttemptBase):
    """Schema for recording an evaluation attempt."""

    evaluation_id: Optional[str] = Field(None, description="ID of parent evaluation")


class EvaluationAttemptResponse(EvaluationAttemptBase):
    """Schema returned for an evaluation attempt."""

    id: str
    evaluation_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EvaluationBase(BaseModel):
    """Base schema for evaluation results aligned with current database contract."""

    model_name: str = Field(..., description="Evaluated model identifier")
    provider_name: str = Field(..., description="Provider identifier (gemini, groq)")
    input_tokens: int = Field(0, ge=0, description="Number of tokens consumed by the prompt")
    output_tokens: int = Field(0, ge=0, description="Number of tokens generated in response")
    execution_cost: Decimal = Field(Decimal("0"), description="Calculated monetary cost in USD")
    latency_ms: float = Field(0.0, ge=0.0, description="Response latency in milliseconds")
    quality_score: Optional[float] = Field(None, ge=0.0, le=10.0, description="LLM-as-a-judge score from 0.0 to 10.0")
    response_text: Optional[str] = Field(None, description="Candidate model generated output")
    status: str = Field("completed", description="Evaluation status (completed, failed)")
    attempt_count: int = Field(1, ge=1, description="Total invocation attempts including retries")
    repeat_index: int = Field(0, ge=0, description="Repeat index for benchmark iteration")
    prompt_version: str = Field("original", description="Prompt variation version identifier")
    judge_reasoning: Optional[str] = Field(None, description="Reasoning narrative from LLM-as-a-Judge")


class EvaluationCreate(EvaluationBase):
    """Schema for submitting an evaluation record with legacy field fallback support."""

    benchmark_id: str
    test_case_id: Optional[str] = None

    # Legacy field inputs for backwards compatibility
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_cost: Optional[float] = None
    judge_score: Optional[float] = None

    @model_validator(mode="before")
    @classmethod
    def map_legacy_fields(cls, values: dict) -> dict:
        """Map legacy column names to current contract columns if provided."""
        if not isinstance(values, dict):
            return values

        if "prompt_tokens" in values and "input_tokens" not in values:
            values["input_tokens"] = values.get("prompt_tokens") or 0
        if "completion_tokens" in values and "output_tokens" not in values:
            values["output_tokens"] = values.get("completion_tokens") or 0
        if "total_cost" in values and "execution_cost" not in values:
            cost = values.get("total_cost")
            values["execution_cost"] = Decimal(str(cost)) if cost is not None else Decimal("0")
        if "judge_score" in values and "quality_score" not in values:
            values["quality_score"] = values.get("judge_score")

        return values


class EvaluationResponse(EvaluationBase):
    """Schema returned for an evaluation record."""

    id: str
    benchmark_id: str
    test_case_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # Backward-compatible property accessors for legacy clients
    @computed_field  # type: ignore[prop-decorator]
    @property
    def prompt_tokens(self) -> int:
        return self.input_tokens

    @computed_field  # type: ignore[prop-decorator]
    @property
    def completion_tokens(self) -> int:
        return self.output_tokens

    @computed_field  # type: ignore[prop-decorator]
    @property
    def total_cost(self) -> float:
        return float(self.execution_cost)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def judge_score(self) -> Optional[float]:
        return self.quality_score

    model_config = ConfigDict(from_attributes=True)


class EvaluationDetailResponse(EvaluationResponse):
    """Evaluation response including full attempt breakdown."""

    attempts: List[EvaluationAttemptResponse] = Field(default_factory=list)
