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
    """Abstract Base Class for all AI model providers.

    All specific providers (Gemini, OpenAI, Groq, Anthropic, etc.) must implement
    this interface to ensure the benchmark engine remains fully provider-agnostic.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Unique identifier of the provider (e.g. 'gemini', 'openai', 'groq')."""
        pass

    @property
    @abstractmethod
    def display_name(self) -> str:
        """Human-readable display name of the provider."""
        pass

    @property
    @abstractmethod
    def supported_models(self) -> List[str]:
        """List of model identifiers supported by this provider."""
        pass

    @property
    def default_model(self) -> str:
        """Default model for this provider."""
        models = self.supported_models
        return models[0] if models else ""

    def is_configured(self) -> bool:
        """Return True if required API credentials exist."""
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
        """Asynchronously send a prompt to the provider and return a standardized result.

        Args:
            prompt: User/workload prompt.
            model: Specific model name to target (defaults to provider's default model).
            system_prompt: Optional system instructions or persona.
            mock: If True, return a simulated result without calling external APIs.
            kwargs: Provider-specific inference parameters (temperature, max_tokens, etc.).

        Returns:
            ProviderResult containing response content, token counts, latency, and costs.
        """
        pass

    async def check_health(self) -> bool:
        """Verify API connectivity and credential validity."""
        return self.is_configured()
