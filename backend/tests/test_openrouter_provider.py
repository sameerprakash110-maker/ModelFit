"""OpenRouter provider: request shape, response parsing, cost, and error handling (no network)."""
from types import SimpleNamespace

import httpx
import pytest

import app.providers as providers_pkg
from app.providers import PROVIDER_CLASSES, get_provider
from app.providers import openrouter as openrouter_module
from app.providers.openrouter import OpenRouterProvider
from app.services.cost_service import CostService


class FakeResponse:
    def __init__(self, status_code, body):
        self.status_code = status_code
        self._body = body
        self.text = str(body)

    def json(self):
        return self._body

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("error", request=None, response=None)


class FakeClient:
    """Stands in for httpx.AsyncClient and records each POST."""

    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def __call__(self, timeout):
        return self

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def post(self, url, headers, json):
        self.calls.append({"url": url, "headers": headers, "json": json})
        return self.responses.pop(0)


def test_registered_and_every_model_is_priced():
    assert PROVIDER_CLASSES["openrouter"] is OpenRouterProvider
    for model in OpenRouterProvider(api_key=None).supported_models:
        assert CostService.calculate_cost(model, 1_000_000, 0) is not None, model


def test_model_ids_do_not_collide_with_other_providers():
    mine = set(OpenRouterProvider(api_key=None).supported_models)
    for name, cls in PROVIDER_CLASSES.items():
        if name != "openrouter":
            assert not mine & set(cls(api_key=None).supported_models), name


def test_get_provider_reads_openrouter_key(monkeypatch):
    monkeypatch.setattr(providers_pkg, "get_settings", lambda: SimpleNamespace(OPENROUTER_API_KEY="k-123"))
    assert get_provider("openrouter").api_key == "k-123"


@pytest.mark.asyncio
async def test_mock_mode_makes_no_request(monkeypatch):
    monkeypatch.setattr(openrouter_module.httpx, "AsyncClient", lambda **kw: pytest.fail("network used"))
    result = await OpenRouterProvider(api_key=None).generate("hello there", mock=True)
    assert result.is_mock and "MOCK OPENROUTER" in result.content


@pytest.mark.asyncio
async def test_unconfigured_raises():
    with pytest.raises(ValueError, match="not configured"):
        await OpenRouterProvider(api_key="  ").generate("hi")


@pytest.mark.asyncio
async def test_successful_call_parses_text_tokens_and_cost(monkeypatch):
    client = FakeClient([
        FakeResponse(200, {
            "model": "anthropic/claude-haiku-5.5",
            "choices": [{"message": {"content": "Routed to billing."}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 1000, "completion_tokens": 200},
        })
    ])
    monkeypatch.setattr(openrouter_module.httpx, "AsyncClient", client)

    result = await OpenRouterProvider(api_key="sk-or-test").generate(
        "Charged twice", model="anthropic/claude-haiku-5.5", system_prompt="Triage tickets."
    )

    sent = client.calls[0]
    assert sent["url"] == "https://openrouter.ai/api/v1/chat/completions"
    assert sent["headers"]["Authorization"] == "Bearer sk-or-test"
    assert sent["json"]["model"] == "anthropic/claude-haiku-5.5"
    assert sent["json"]["messages"][0] == {"role": "system", "content": "Triage tickets."}
    assert sent["json"]["max_tokens"] == OpenRouterProvider.DEFAULT_MAX_TOKENS
    assert result.content == "Routed to billing."
    assert (result.prompt_tokens, result.completion_tokens) == (1000, 200)
    # 1000 tokens at $0.10/M in + 200 tokens at $0.50/M out
    assert result.cost_usd == pytest.approx(0.0002)


@pytest.mark.asyncio
async def test_upstream_error_in_200_body_raises(monkeypatch):
    client = FakeClient([FakeResponse(200, {"error": {"message": "Provider overloaded"}})])
    monkeypatch.setattr(openrouter_module.httpx, "AsyncClient", client)
    with pytest.raises(RuntimeError, match="Provider overloaded"):
        await OpenRouterProvider(api_key="sk-or-test").generate("hi")


@pytest.mark.asyncio
async def test_http_error_raises_with_status(monkeypatch):
    client = FakeClient([FakeResponse(401, {"error": {"message": "No auth"}})])
    monkeypatch.setattr(openrouter_module.httpx, "AsyncClient", client)
    with pytest.raises(RuntimeError, match="HTTP 401"):
        await OpenRouterProvider(api_key="sk-or-bad").generate("hi")
