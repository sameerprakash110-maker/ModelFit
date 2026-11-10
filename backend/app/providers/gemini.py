import time
from typing import Any, List, Optional
from app.providers.base import BaseLLMProvider, ProviderResult


class GeminiProvider(BaseLLMProvider):
    """Google Gemini AI Provider implementation."""

    @property
    def provider_name(self) -> str:
        return "gemini"

    @property
    def display_name(self) -> str:
        return "Google Gemini"

    @property
    def supported_models(self) -> List[str]:
        return [
            "gemini-2.0-flash-exp",
            "gemini-1.5-pro",
            "gemini-1.5-flash",
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
            # Placeholder mock response for testing/dry runs
            latency_ms = (time.perf_counter() - start_time) * 1000
            return ProviderResult(
                content=f"[MOCK GEMINI RESPONSE for '{target_model}'] Processed prompt: {prompt[:40]}...",
                model=target_model,
                provider=self.provider_name,
                latency_ms=max(latency_ms, 120.0),
                prompt_tokens=len(prompt.split()),
                completion_tokens=25,
                cost_usd=0.00005,
                is_mock=True,
                raw_metadata={"mock": True, "engine": "gemini-mock"},
            )

        raise NotImplementedError(
            "Live Gemini API calls are not yet enabled in this architecture milestone. "
            "Use mock=True for local simulations or configure live provider engine."
        )
