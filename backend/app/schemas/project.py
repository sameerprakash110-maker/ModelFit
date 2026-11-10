from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field


class ProjectBase(BaseModel):
    """Base project schema with shared fields."""

    name: str = Field(..., min_length=1, max_length=255, description="Project name")
    description: Optional[str] = Field(None, description="Detailed project description")
    business_domain: Optional[str] = Field(None, max_length=100, description="Business domain (e.g. Finance, Healthcare)")
    # system_prompt is required (matches NOT NULL database contract)
    system_prompt: str = Field(..., description="Default system prompt / context for project workloads")

    # Additive nullable JSON fields
    output_schema: Optional[Dict[str, Any]] = Field(
        None, description="Optional JSON schema for expected output format"
    )
    rubric: Optional[Dict[str, Any]] = Field(
        None, description="Optional scoring rubric for LLM-as-a-Judge evaluation"
    )


class ProjectCreate(ProjectBase):
    """Schema for project creation."""
    pass


class ProjectUpdate(BaseModel):
    """Schema for updating an existing project."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    business_domain: Optional[str] = Field(None, max_length=100)
    system_prompt: Optional[str] = None
    output_schema: Optional[Dict[str, Any]] = None
    rubric: Optional[Dict[str, Any]] = None


class ProjectResponse(ProjectBase):
    """Schema returned to API clients representing a project."""

    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
