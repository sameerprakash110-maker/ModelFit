import time

import httpx

from app.core.config import get_settings
from app.core.exceptions import EntityNotFoundException
from app.schemas.provider import ProviderHealthResponse


class ProviderHealthService:
    """Checks provider connectivity using non-generative model catalog endpoints."""

    _ENDPOINTS = {
        "gemini": "https://generativelanguage.googleapis.com/v1beta/models",
        "groq": "https://api.groq.com/openai/v1/models",
    }
    _TIMEOUT_SECONDS = 5.0

    @classmethod
    async def check_health(cls, provider_name: str) -> ProviderHealthResponse:
        name = provider_name.lower().strip()
        if name not in cls._ENDPOINTS:
            raise EntityNotFoundException("Provider", provider_name)

        settings = get_settings()
        api_key = (
            settings.GEMINI_API_KEY if name == "gemini" else settings.GROQ_API_KEY
        )
        if not api_key or not api_key.strip():
            return ProviderHealthResponse(
                provider_name=name,
                is_configured=False,
                is_healthy=False,
                status="not_configured",
                message=f"{name.title()} API key is not configured.",
            )

        headers = (
            {"x-goog-api-key": api_key.strip()}
            if name == "gemini"
            else {"Authorization": f"Bearer {api_key.strip()}"}
        )
        started = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=cls._TIMEOUT_SECONDS) as client:
                response = await client.get(cls._ENDPOINTS[name], headers=headers)
            latency_ms = (time.perf_counter() - started) * 1000
        except httpx.TimeoutException:
            return cls._result(
                name,
                "unavailable",
                "Provider health check timed out.",
                (time.perf_counter() - started) * 1000,
            )
        except httpx.RequestError:
            return cls._result(
                name,
                "unavailable",
                "Provider API could not be reached.",
                (time.perf_counter() - started) * 1000,
            )
        except Exception:
            return cls._result(
                name,
                "error",
                "Provider health check failed unexpectedly.",
                (time.perf_counter() - started) * 1000,
            )

        if 200 <= response.status_code < 300:
            return cls._result(
                name,
                "healthy",
                "Provider API is reachable and the API key is valid.",
                latency_ms,
            )
        if response.status_code in (401, 403):
            return cls._result(
                name, "authentication_error", "Provider rejected the API key.", latency_ms
            )
        if response.status_code == 429:
            return cls._result(
                name,
                "rate_limited",
                "Provider rate limit was reached during the health check.",
                latency_ms,
            )
        if response.status_code >= 500:
            return cls._result(
                name, "unavailable", "Provider API is currently unavailable.", latency_ms
            )
        return cls._result(
            name,
            "error",
            f"Provider API returned unexpected HTTP status {response.status_code}.",
            latency_ms,
        )

    @staticmethod
    def _result(
        provider_name: str,
        status: str,
        message: str,
        latency_ms: float,
    ) -> ProviderHealthResponse:
        return ProviderHealthResponse(
            provider_name=provider_name,
            is_configured=True,
            is_healthy=status == "healthy",
            status=status,
            latency_ms=round(latency_ms, 2),
            message=message,
        )
