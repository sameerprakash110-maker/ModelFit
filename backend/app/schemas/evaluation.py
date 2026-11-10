from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class EvaluationBase(BaseModel):
    """Base schema for evaluation results."""

    model_name: str = Field(..., description="Evaluated model identifier")
    provider_name: str = Field(..., description="Provider identifier (gemini, openai, groq)")
    prompt_tokens: Optional[int] = Field(None, description="Number of tokens consumed by the prompt")
    completion_tokens: Optional[int] = Field(None, description="Number of tokens generated in response")
    total_cost: Optional[float] = Field(None, description="Calculated monetary cost in USD")
    latency_ms: Optional[float] = Field(None, description="Response latency in milliseconds")
    judge_score: Optional[float] = Field(None, description="LLM-as-a-judge score from 0.0 to 10.0")
    response_text: Optional[str] = Field(None, description="Raw or formatted model output")
    status: str = Field("completed", description="Evaluation status")


class EvaluationCreate(EvaluationBase):
    """Schema for submitting an evaluation record."""

    benchmark_id: str
    test_case_id: Optional[str] = None


class EvaluationResponse(EvaluationBase):
    """Schema returned for an evaluation record."""

    id: str
    benchmark_id: str
    test_case_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
