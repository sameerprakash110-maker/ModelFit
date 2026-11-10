from pydantic import BaseModel, ConfigDict
from typing import Optional, Literal


class ProviderResult(BaseModel):

    provider_name: str
    model_name: str

    response_text: Optional[str] = None

    input_tokens: int = 0
    output_tokens: int = 0

    latency_ms: float = 0.0
    execution_cost: float = 0.0

    status: Literal["success", "failed"]

    error_message: Optional[str] = None

    model_config = ConfigDict(
        from_attributes=True
    )


class ProviderInfo(BaseModel):

    name: str
    display_name: str
    configured: bool
    supported_models: list[str]
