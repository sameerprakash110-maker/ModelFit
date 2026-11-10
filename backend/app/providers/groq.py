import time
from typing import Any, List, Optional
from app.providers.base import BaseLLMProvider, ProviderResult


class GroqProvider(BaseLLMProvider):
    """Groq High-Speed LPU Inference Provider implementation."""

    @property
    def provider_name(self) -> str:
        return "groq"

    @property
    def display_name(self) -> str:
        return "Groq"

    @property
    def supported_models(self) -> List[str]:
        return [
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
            "mixtral-8x7b-32768",
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
                content=f"[MOCK GROQ RESPONSE for '{target_model}'] Processed prompt: {prompt[:40]}...",
                model=target_model,
                provider=self.provider_name,
                latency_ms=max(latency_ms, 45.0),
                prompt_tokens=len(prompt.split()),
                completion_tokens=25,
                cost_usd=0.00002,
                is_mock=True,
                raw_metadata={"mock": True, "engine": "groq-mock"},
            )

        raise NotImplementedError(
            "Live Groq API calls are not yet enabled in this architecture milestone. "
            "Use mock=True for local simulations or configure live provider engine."
        )
