from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class TestCaseBase(BaseModel):
    """Base schema for test cases."""

    input_prompt: str = Field(..., min_length=1, description="Input prompt payload sent to the model")
    expected_behavior: str = Field(..., description="Expected model answer or reasoning behavior")
    # JSON per database contract — structured scoring / pass-fail criteria
    evaluation_criteria: Optional[Dict[str, Any]] = Field(
        None, description="Structured evaluation criteria for LLM Judge or scoring metric"
    )


class TestCaseCreate(TestCaseBase):
    """Schema for creating a new test case."""

    project_id: str = Field(..., description="ID of the project to associate this test case with")


class TestCaseUpdate(BaseModel):
    """Schema for updating an existing test case."""

    input_prompt: Optional[str] = Field(None, min_length=1)
    expected_behavior: Optional[str] = None
    evaluation_criteria: Optional[Dict[str, Any]] = None

    @field_validator("expected_behavior")
    @classmethod
    def expected_behavior_cannot_be_null(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            raise ValueError("expected_behavior cannot be null")
        return value


class TestCaseResponse(TestCaseBase):
    """Schema returned for a test case."""

    id: str
    project_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
