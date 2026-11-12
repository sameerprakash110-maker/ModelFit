from types import SimpleNamespace

import httpx
import pytest

from app.schemas.provider import ProviderHealthResponse
from app.services import provider_health_service


class FakeResponse:
    def __init__(self, status_code):
        self.status_code = status_code


class FakeAsyncClient:
    def __init__(self, response=None, error=None, timeout=None):
        self.response = response
        self.error = error
        self.timeout = timeout
        self.url = None
        self.headers = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def get(self, url, headers):
        self.url = url
        self.headers = headers
        if self.error:
            raise self.error
        return self.response


def configure(monkeypatch, gemini="gemini-secret", groq="groq-secret", openrouter="openrouter-secret"):
    monkeypatch.setattr(
        provider_health_service,
        "get_settings",
        lambda: SimpleNamespace(GEMINI_API_KEY=gemini, GROQ_API_KEY=groq, OPENROUTER_API_KEY=openrouter),
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("provider", "url", "auth_header", "expected_key"),
    [
        (
            "gemini",
            "https://generativelanguage.googleapis.com/v1beta/models",
            "x-goog-api-key",
            "gemini-secret",
        ),
        (
            "groq",
            "https://api.groq.com/openai/v1/models",
            "Authorization",
            "Bearer groq-secret",
        ),
        (
            "openrouter",
            "https://openrouter.ai/api/v1/key",
            "Authorization",
            "Bearer openrouter-secret",
        ),
    ],
)
async def test_successful_health_check_uses_models_endpoint_and_returns_latency(
    monkeypatch, provider, url, auth_header, expected_key
):
    configure(monkeypatch)
    client = None

    def fake_client(timeout):
        nonlocal client
        client = FakeAsyncClient(response=FakeResponse(200), timeout=timeout)
        return client

    monkeypatch.setattr(provider_health_service.httpx, "AsyncClient", fake_client)

    result = await provider_health_service.ProviderHealthService.check_health(provider)

    assert result.status == "healthy"
    assert result.is_configured and result.is_healthy
    assert result.provider_name == provider
    assert result.latency_ms is not None and result.latency_ms >= 0
    assert client.url == url
    assert client.headers[auth_header] == expected_key
    assert client.timeout == provider_health_service.ProviderHealthService._TIMEOUT_SECONDS


@pytest.mark.asyncio
@pytest.mark.parametrize("provider", ["gemini", "groq", "openrouter"])
async def test_missing_api_key_does_not_make_request(monkeypatch, provider):
    configure(monkeypatch, gemini="", groq="", openrouter="")
    monkeypatch.setattr(
        provider_health_service.httpx,
        "AsyncClient",
        lambda **kwargs: pytest.fail("HTTP request made without a key"),
    )

    result = await provider_health_service.ProviderHealthService.check_health(provider)

    assert result.status == "not_configured"
    assert result.is_configured is False
    assert result.is_healthy is False
    assert result.latency_ms is None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("status_code", "expected_status"),
    [
        (401, "authentication_error"),
        (403, "authentication_error"),
        (429, "rate_limited"),
        (500, "unavailable"),
        (503, "unavailable"),
        (400, "error"),
    ],
)
async def test_http_failures_are_classified_without_exposing_keys(
    monkeypatch, status_code, expected_status
):
    configure(monkeypatch)
    monkeypatch.setattr(
        provider_health_service.httpx,
        "AsyncClient",
        lambda timeout: FakeAsyncClient(response=FakeResponse(status_code)),
    )

    result = await provider_health_service.ProviderHealthService.check_health("gemini")

    assert result.status == expected_status
    assert result.is_healthy is False
    assert "gemini-secret" not in result.message
    assert "groq-secret" not in result.message


@pytest.mark.asyncio
async def test_timeout_is_reported_as_unavailable(monkeypatch):
    configure(monkeypatch)
    monkeypatch.setattr(
        provider_health_service.httpx,
        "AsyncClient",
        lambda timeout: FakeAsyncClient(error=httpx.TimeoutException("late")),
    )

    result = await provider_health_service.ProviderHealthService.check_health("groq")

    assert result.status == "unavailable"
    assert result.is_healthy is False
    assert result.latency_ms is not None


@pytest.mark.asyncio
async def test_connection_error_is_reported_as_unavailable(monkeypatch):
    configure(monkeypatch)
    request = httpx.Request(
        "GET", "https://api.groq.com/openai/v1/models"
    )
    monkeypatch.setattr(
        provider_health_service.httpx,
        "AsyncClient",
        lambda timeout: FakeAsyncClient(
            error=httpx.ConnectError("connection refused", request=request),
            timeout=timeout,
        ),
    )

    result = await provider_health_service.ProviderHealthService.check_health("groq")

    assert result.status == "unavailable"
    assert result.is_healthy is False
    assert result.latency_ms is not None
    assert "groq-secret" not in result.message


@pytest.mark.asyncio
async def test_unexpected_exception_is_reported_without_exposing_details(monkeypatch):
    configure(monkeypatch)
    monkeypatch.setattr(
        provider_health_service.httpx,
        "AsyncClient",
        lambda timeout: FakeAsyncClient(
            error=RuntimeError("unexpected failure groq-secret"), timeout=timeout
        ),
    )

    result = await provider_health_service.ProviderHealthService.check_health("groq")

    assert result.status == "error"
    assert result.is_healthy is False
    assert result.latency_ms is not None
    assert "groq-secret" not in result.message


@pytest.mark.asyncio
async def test_health_endpoint_is_exposed(client, monkeypatch):
    expected = ProviderHealthResponse(
        provider_name="gemini",
        is_configured=True,
        is_healthy=True,
        status="healthy",
        latency_ms=2.5,
        message="Provider API is reachable and the API key is valid.",
    )

    async def fake_check(provider_name):
        assert provider_name == "gemini"
        return expected

    monkeypatch.setattr(
        provider_health_service.ProviderHealthService,
        "check_health",
        fake_check,
    )
    response = client.get("/api/v1/providers/gemini/health")

    assert response.status_code == 200
    assert response.json() == expected.model_dump()
