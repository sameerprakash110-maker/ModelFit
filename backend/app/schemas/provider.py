from typing import List, Optional
from pydantic import BaseModel, Field


class ProviderModelDetail(BaseModel):
    """Detailed metadata for a model offered by a provider."""

    model_id: str
    display_name: str
    context_window: int
    input_cost_per_million: float
    output_cost_per_million: float


class ProviderResponse(BaseModel):
    """Schema representing an AI provider and its configuration status."""

    name: str = Field(..., description="Unique provider key (e.g. 'gemini', 'openai', 'groq')")
    display_name: str = Field(..., description="Human-readable provider name")
    description: Optional[str] = Field(None, description="Provider summary and capabilities")
    is_configured: bool = Field(..., description="Indicates if API credentials are provided in the environment")
    is_active: bool = Field(True, description="Whether the provider is currently active")
    supported_models: List[str] = Field(default_factory=list, description="List of available models")
    default_model: Optional[str] = Field(None, description="Recommended default model for this provider")


class ProviderListResponse(BaseModel):
    """List of all supported providers."""

    providers: List[ProviderResponse]
    total: int
