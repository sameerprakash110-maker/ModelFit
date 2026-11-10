import time
from typing import Any, List, Optional
from app.providers.base import BaseLLMProvider, ProviderResult


class OpenAIProvider(BaseLLMProvider):
    """OpenAI Model Provider implementation."""

    @property
    def provider_name(self) -> str:
        return "openai"

    @property
    def display_name(self) -> str:
        return "OpenAI"

    @property
    def supported_models(self) -> List[str]:
        return [
            "gpt-4o",
            "gpt-4o-mini",
            "o1-preview",
            "o1-mini",
        ]

    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        system_prompt: Optional[str] = None,
        mock: bool = False,
        **kwargs: Any,
    ) -> ProviderResult:
        target_model = model or self.default_model

        if mock:
            start_time = time.perf_counter()
            latency_ms = (time.perf_counter() - start_time) * 1000
            return ProviderResult(
                content=f"[MOCK OPENAI RESPONSE for '{target_model}'] Processed prompt: {prompt[:40]}...",
                model=target_model,
                provider=self.provider_name,
                latency_ms=max(latency_ms, 150.0),
                prompt_tokens=len(prompt.split()),
                completion_tokens=28,
                cost_usd=0.00012,
                is_mock=True,
                raw_metadata={"mock": True, "engine": "openai-mock"},
            )

        raise NotImplementedError(
            "Live OpenAI API calls are not yet enabled in this architecture milestone. "
            "Use mock=True for local simulations or configure live provider engine."
        )
