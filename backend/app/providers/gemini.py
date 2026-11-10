import asyncio
import time
from typing import Any, Dict, List, Optional

import httpx

from app.providers.base import BaseLLMProvider, ProviderResult


class GeminiProvider(BaseLLMProvider):
    """Google Gemini API integration."""

    def __init__(self, api_key: Optional[str] = None):
        super().__init__(api_key=api_key)

    @property
    def provider_name(self) -> str:
        return "gemini"

    @property
    def display_name(self) -> str:
        return "Google Gemini"

    @property
    def supported_models(self) -> List[str]:
        return [
            "gemini-3.1-flash-lite",
            "gemini-3.8-flash",
            "gemini-3.5-flash",
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
                content=f"[MOCK GEMINI RESPONSE] {prompt[:40]}...",
                model=target_model,
                provider=self.provider_name,
                latency_ms=45.0,
                prompt_tokens=len(prompt.split()),
                completion_tokens=20,
                cost_usd=0.0,
                is_mock=True,
                raw_metadata={"mock": True},
            )

        if not self.is_configured():
            raise ValueError("Gemini API key is not configured.")

        url = (
            "https://generativelanguage.googleapis.com/"
            f"v1beta/models/{target_model}:generateContent"
        )

        headers = {
            "x-goog-api-key": self.api_key,
            "Content-Type": "application/json",
        }

        contents = []

        if system_prompt:
            contents.append({
                "role": "user",
                "parts": [{"text": system_prompt}],
            })

            contents.append({
                "role": "model",
                "parts": [{"text": "Understood."}],
            })

        contents.append({
            "role": "user",
            "parts": [{"text": prompt}],
        })

        payload = {
            "contents": contents,
        }

        if kwargs:
            generation_config = {}

            if "temperature" in kwargs:
                generation_config["temperature"] = kwargs["temperature"]

            if "max_tokens" in kwargs:
                generation_config["maxOutputTokens"] = kwargs["max_tokens"]

            if generation_config:
                payload["generationConfig"] = generation_config

        start_time = time.perf_counter()

        async with httpx.AsyncClient(timeout=60.0) as client:

            response = None

            for attempt in range(3):

                response = await client.post(
                    url,
                    headers=headers,
                    json=payload,
                )

                if response.status_code in (429, 503):

                    if attempt == 2:
                        response.raise_for_status()

                    await asyncio.sleep(2 ** attempt)
                    continue

                response.raise_for_status()
                break

            data = response.json()

        latency = (time.perf_counter() - start_time) * 1000

        candidates = data.get("candidates", [])

        if not candidates:
            raise ValueError("Gemini returned no response candidates.")

        parts = candidates[0].get("content", {}).get("parts", [])

        response_text = "".join(
            part.get("text", "")
            for part in parts
        )

        usage = data.get("usageMetadata", {})

        return ProviderResult(
            content=response_text,
            model=target_model,
            provider=self.provider_name,
            latency_ms=latency,
            prompt_tokens=usage.get("promptTokenCount", 0),
            completion_tokens=usage.get("candidatesTokenCount", 0),
            cost_usd=0.0,
            is_mock=False,
            raw_metadata={
                "usage_metadata": usage,
                "finish_reason": candidates[0].get("finishReason"),
            },
        )