from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class ProjectBase(BaseModel):
    """Base project schema with shared fields."""

    name: str = Field(..., min_length=1, max_length=255, description="Project name")
    description: Optional[str] = Field(None, description="Detailed project description")
    business_domain: Optional[str] = Field(None, max_length=100, description="Business domain (e.g. Finance, Healthcare)")
    system_prompt: Optional[str] = Field(None, description="Default system prompt / context for project workloads")


class ProjectCreate(ProjectBase):
    """Schema for project creation."""
    pass


class ProjectUpdate(BaseModel):
    """Schema for updating an existing project."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    business_domain: Optional[str] = Field(None, max_length=100)
    system_prompt: Optional[str] = None


class ProjectResponse(ProjectBase):
    """Schema returned to API clients representing a project."""

    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
