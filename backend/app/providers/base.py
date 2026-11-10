from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class ProviderResult:
    """Standardized output returned from any LLM provider invocation."""

    content: str
    model: str
    provider: str
    latency_ms: float = 0.0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    cost_usd: float = 0.0
    is_mock: bool = False
    raw_metadata: Dict[str, Any] = field(default_factory=dict)


class BaseLLMProvider(ABC):

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key

    @property
    @abstractmethod
    def provider_name(self) -> str:
        pass

    @property
    @abstractmethod
    def display_name(self) -> str:
        pass

    @property
    @abstractmethod
    def supported_models(self) -> List[str]:
        pass

    @property
    def default_model(self) -> str:
        models = self.supported_models
        return models[0] if models else ""

    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        system_prompt: Optional[str] = None,
        mock: bool = False,
        **kwargs: Any,
    ) -> ProviderResult:
        pass

    async def check_health(self) -> bool:
        return self.is_configured()