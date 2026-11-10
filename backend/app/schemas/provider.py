from typing import List, Optional, Literal
from pydantic import BaseModel, Field, ConfigDict


class ProviderModelDetail(BaseModel):
    """Detailed metadata for a model offered by a provider."""

    model_id: str
    display_name: str
    context_window: int
    input_cost_per_million: float
    output_cost_per_million: float


class ProviderResponse(BaseModel):
    """Schema representing an AI provider and its configuration status."""

    name: str = Field(..., description="Unique provider key")
    display_name: str = Field(..., description="Human-readable provider name")
    description: Optional[str] = Field(None, description="Provider summary and capabilities")
    is_configured: bool = Field(..., description="Indicates if API credentials are provided")
    is_active: bool = Field(True, description="Whether the provider is currently active")
    supported_models: List[str] = Field(default_factory=list)
    default_model: Optional[str] = Field(None, description="Recommended default model")


class ProviderListResponse(BaseModel):
    """List of all supported providers."""

    providers: List[ProviderResponse]
    total: int


class ProviderHealthResponse(BaseModel):
    """Live API connectivity and credential status for a provider."""

    provider_name: str
    is_configured: bool
    is_healthy: bool
    status: Literal[
        "healthy",
        "not_configured",
        "authentication_error",
        "rate_limited",
        "unavailable",
        "error",
    ]
    latency_ms: Optional[float] = None
    message: str


class ProviderResult(BaseModel):
    """Standardized result returned after executing an LLM request."""

    provider_name: str
    model_name: str

    response_text: Optional[str] = None

    input_tokens: int = 0
    output_tokens: int = 0

    latency_ms: float = 0.0
    execution_cost: float = 0.0

    status: Literal["success", "failed"]

    error_message: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
