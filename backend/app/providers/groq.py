import asyncio
import time
from typing import Any, List, Optional

import httpx

from app.providers.base import BaseLLMProvider, ProviderResult


class GroqProvider(BaseLLMProvider):
    """Groq provider using the Chat Completions API."""

    _BASE_URL = "https://api.groq.com/openai/v1/chat/completions"

    @property
    def provider_name(self) -> str:
        return "groq"

    @property
    def display_name(self) -> str:
        return "Groq"

    @property
    def supported_models(self) -> List[str]:
        return [
            "qwen/qwen3.8-27b",
            "openai/gpt-oss-120b",
            "openai/gpt-oss-20b",
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

        # Mock execution
        if mock:
            return ProviderResult(
                content=f"[MOCK GROQ RESPONSE for '{target_model}'] "
                        f"Processed prompt: {prompt[:40]}...",
                model=target_model,
                provider=self.provider_name,
                latency_ms=45.0,
                prompt_tokens=len(prompt.split()),
                completion_tokens=25,
                cost_usd=0.00002,
                is_mock=True,
                raw_metadata={"mock": True, "engine": "groq-mock"},
            )

        # Check API key
        if not self.is_configured():
            raise ValueError("Groq API key is not configured.")

        # Prepare messages
        messages = []

        if system_prompt:
            messages.append({
                "role": "system",
                "content": system_prompt,
            })

        messages.append({
            "role": "user",
            "content": prompt,
        })

        # Prepare request headers
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        # Prepare request payload
        payload = {
            "model": target_model,
            "messages": messages,
        }

        if "temperature" in kwargs:
            payload["temperature"] = kwargs["temperature"]

        if "max_tokens" in kwargs:
            payload["max_tokens"] = kwargs["max_tokens"]

        # Send API request
        start_time = time.perf_counter()

        async with httpx.AsyncClient(timeout=60.0) as client:

            response = None

            for attempt in range(3):

                response = await client.post(
                    self._BASE_URL,
                    headers=headers,
                    json=payload,
                )

                # Retry rate-limit and temporary server errors
                if response.status_code in (429, 503):

                    if attempt == 2:
                        break

                    await asyncio.sleep(2 ** attempt)
                    continue

                break

            # Raise a useful error containing Groq's response body
            try:
                response.raise_for_status()

            except httpx.HTTPStatusError as exc:
                error_details = response.text

                raise RuntimeError(
                    f"Groq API returned HTTP {response.status_code}: "
                    f"{error_details}"
                ) from exc

            data = response.json()

        # Calculate latency
        latency = (time.perf_counter() - start_time) * 1000

        # Extract response
        choices = data.get("choices", [])

        if not choices:
            raise ValueError("Groq returned no response choices.")

        response_text = choices[0].get(
            "message", {}
        ).get("content", "")

        # Extract token usage
        usage = data.get("usage", {})

        prompt_tokens = usage.get("prompt_tokens", 0)
        completion_tokens = usage.get("completion_tokens", 0)

        # Calculate execution cost
        from app.services.cost_service import CostService

        computed_cost = CostService.calculate_cost(
            target_model,
            prompt_tokens,
            completion_tokens,
        )

        # Return standardized result
        return ProviderResult(
            content=response_text,
            model=target_model,
            provider=self.provider_name,
            latency_ms=latency,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            cost_usd=(
                computed_cost if computed_cost is not None else 0.0
            ),
            is_mock=False,
            raw_metadata={
                "usage": usage,
                "finish_reason": choices[0].get("finish_reason"),
            },
        )
