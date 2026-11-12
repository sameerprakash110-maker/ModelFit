import asyncio
import time
from typing import Any, List, Optional

import httpx

from app.providers.base import BaseLLMProvider, ProviderResult


class OpenRouterProvider(BaseLLMProvider):
    """OpenRouter provider: one OpenAI-compatible API in front of many model vendors.

    Model ids here must not overlap with another provider's (e.g. Groq serves
    `openai/gpt-oss-*`), because a benchmark resolves each model to exactly one provider.
    Prices for every model listed live in CostService.PRICING_TABLE.
    """

    _BASE_URL = "https://openrouter.ai/api/v1/chat/completions"
    # Without a cap, OpenRouter reserves credit for the model's full output window
    # (often 64k+ tokens) and rejects the call (HTTP 402) on low-balance accounts.
    DEFAULT_MAX_TOKENS = 4096

    @property
    def provider_name(self) -> str:
        return "openrouter"

    @property
    def display_name(self) -> str:
        return "OpenRouter"

    @property
    def supported_models(self) -> List[str]:
        return [
            "anthropic/claude-haiku-5.5",
            "anthropic/claude-sonnet-5.5",
            "openai/gpt-6-luna",
            "openai/gpt-6.1-terra",
            "deepseek/deepseek-v4.1-flash",
            "mistralai/mistral-large-4-0",
            "x-ai/grok-4.7",
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
            return ProviderResult(
                content=f"[MOCK OPENROUTER RESPONSE for '{target_model}'] "
                        f"Processed prompt: {prompt[:40]}...",
                model=target_model,
                provider=self.provider_name,
                latency_ms=60.0,
                prompt_tokens=len(prompt.split()),
                completion_tokens=25,
                cost_usd=0.00002,
                is_mock=True,
                raw_metadata={"mock": True, "engine": "openrouter-mock"},
            )

        if not self.is_configured():
            raise ValueError("OpenRouter API key is not configured.")

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        headers = {
            "Authorization": f"Bearer {self.api_key.strip()}",
            "Content-Type": "application/json",
            # Optional attribution headers recognised by OpenRouter.
            "X-Title": "ModelFit",
        }
        payload: dict[str, Any] = {
            "model": target_model,
            "messages": messages,
            "max_tokens": kwargs.get("max_tokens", self.DEFAULT_MAX_TOKENS),
        }
        if "temperature" in kwargs:
            payload["temperature"] = kwargs["temperature"]

        start_time = time.perf_counter()

        async with httpx.AsyncClient(timeout=90.0) as client:
            response = None
            for attempt in range(3):
                response = await client.post(self._BASE_URL, headers=headers, json=payload)
                # Retry rate limits and temporary upstream errors
                if response.status_code in (429, 502, 503) and attempt < 2:
                    await asyncio.sleep(2 ** attempt)
                    continue
                break

            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                raise RuntimeError(
                    f"OpenRouter API returned HTTP {response.status_code}: {response.text[:500]}"
                ) from exc

            data = response.json()

        latency = (time.perf_counter() - start_time) * 1000

        # OpenRouter can return 200 with an error body when the upstream vendor fails.
        if data.get("error"):
            message = data["error"].get("message") if isinstance(data["error"], dict) else data["error"]
            raise RuntimeError(f"OpenRouter upstream error: {message}")

        choices = data.get("choices", [])
        if not choices:
            raise ValueError("OpenRouter returned no response choices.")

        response_text = choices[0].get("message", {}).get("content") or ""

        usage = data.get("usage", {}) or {}
        prompt_tokens = usage.get("prompt_tokens", 0) or 0
        completion_tokens = usage.get("completion_tokens", 0) or 0

        from app.services.cost_service import CostService

        computed_cost = CostService.calculate_cost(target_model, prompt_tokens, completion_tokens)

        return ProviderResult(
            content=response_text,
            model=target_model,
            provider=self.provider_name,
            latency_ms=latency,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            cost_usd=computed_cost if computed_cost is not None else 0.0,
            is_mock=False,
            raw_metadata={
                "usage": usage,
                "finish_reason": choices[0].get("finish_reason"),
                "routed_model": data.get("model"),
            },
        )
