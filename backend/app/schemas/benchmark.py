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
        description="List of model identifiers to benchmark (e.g. ['gemini-1.5-pro', 'gpt-4o'])",
    )


class BenchmarkCreate(BenchmarkBase):
    """Schema for creating a new benchmark run."""

    project_id: str = Field(..., description="ID of the project this benchmark belongs to")


class BenchmarkUpdate(BaseModel):
    """Schema for updating an existing benchmark."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[str] = Field(None, description="Execution status: pending, running, completed, failed")


class BenchmarkResponse(BenchmarkBase):
    """Schema returned for a benchmark."""

    id: str
    project_id: str
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
