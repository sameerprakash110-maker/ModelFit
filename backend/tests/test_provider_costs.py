import pytest

from app.providers.gemini import GeminiProvider
from app.services.cost_service import CostService


@pytest.mark.parametrize(
    ("model", "input_rate", "output_rate"),
    [
        ("gemini-3.1-flash-lite", 0.25, 1.50),
        ("gemini-3.8-flash", 0.75, 3.75),
        ("gemini-3.5-flash", 1.50, 9.00),
    ],
)
def test_supported_gemini_model_standard_paid_rates(model, input_rate, output_rate):
    assert CostService.calculate_cost(model, 1_000_000, 0) == input_rate
    assert CostService.calculate_cost(model, 0, 1_000_000) == output_rate


class FakeResponse:
    status_code = 200

    def __init__(self, usage_metadata=None, include_usage=True):
        self.usage_metadata = usage_metadata
        self.include_usage = include_usage

    def raise_for_status(self):
        pass

    def json(self):
        data = {
            "candidates": [
                {"content": {"parts": [{"text": "Generated response"}]}, "finishReason": "STOP"}
            ],
        }
        if self.include_usage:
            data["usageMetadata"] = self.usage_metadata
        return data


class FakeAsyncClient:
    response = FakeResponse(
        {
            "promptTokenCount": 200,
            "candidatesTokenCount": 30,
        }
    )

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def post(self, *args, **kwargs):
        return self.response


@pytest.mark.asyncio
async def test_gemini_generation_reports_cost_from_usage_metadata(monkeypatch):
    FakeAsyncClient.response = FakeResponse(
        {"promptTokenCount": 200, "candidatesTokenCount": 30}
    )
    monkeypatch.setattr("app.providers.gemini.httpx.AsyncClient", FakeAsyncClient)

    result = await GeminiProvider(api_key="test-key").generate(
        prompt="Hello", model="gemini-3.1-flash-lite"
    )

    assert result.prompt_tokens == 200
    assert result.completion_tokens == 30
    assert result.cost_usd == CostService.calculate_cost(
        "gemini-3.1-flash-lite", 200, 30
    )
    assert result.cost_usd == 0.000095
    assert result.raw_metadata["visible_completion_tokens"] == 30
    assert result.raw_metadata["thinking_tokens"] == 0
    assert result.raw_metadata["billable_output_tokens"] == 30


@pytest.mark.asyncio
async def test_gemini_generation_includes_thinking_tokens_in_billable_output(monkeypatch):
    FakeAsyncClient.response = FakeResponse(
        {
            "promptTokenCount": 200,
            "candidatesTokenCount": 30,
            "thoughtsTokenCount": 10,
            "totalTokenCount": 240,
        }
    )
    monkeypatch.setattr("app.providers.gemini.httpx.AsyncClient", FakeAsyncClient)

    result = await GeminiProvider(api_key="test-key").generate(
        prompt="Hello", model="gemini-3.1-flash-lite"
    )

    assert result.prompt_tokens == 200
    assert result.completion_tokens == 40
    assert result.completion_tokens == 30 + 10
    assert result.cost_usd == CostService.calculate_cost(
        "gemini-3.1-flash-lite", 200, 40
    )
    assert result.cost_usd == 0.00011
    assert result.raw_metadata["visible_completion_tokens"] == 30
    assert result.raw_metadata["thinking_tokens"] == 10
    assert result.raw_metadata["billable_output_tokens"] == 40


@pytest.mark.parametrize("usage_metadata", [None, "missing"])
@pytest.mark.asyncio
async def test_gemini_generation_handles_missing_usage_metadata(monkeypatch, usage_metadata):
    if usage_metadata == "missing":
        response = FakeResponse(include_usage=False)
    else:
        response = FakeResponse(usage_metadata)
    FakeAsyncClient.response = response
    monkeypatch.setattr("app.providers.gemini.httpx.AsyncClient", FakeAsyncClient)

    result = await GeminiProvider(api_key="test-key").generate(
        prompt="Hello", model="gemini-3.1-flash-lite"
    )

    assert result.prompt_tokens == 0
    assert result.completion_tokens == 0
    assert result.cost_usd == 0.0


@pytest.mark.asyncio
async def test_gemini_generation_handles_zero_thinking_tokens(monkeypatch):
    FakeAsyncClient.response = FakeResponse(
        {
            "promptTokenCount": 200,
            "candidatesTokenCount": 30,
            "thoughtsTokenCount": 0,
        }
    )
    monkeypatch.setattr("app.providers.gemini.httpx.AsyncClient", FakeAsyncClient)

    result = await GeminiProvider(api_key="test-key").generate(
        prompt="Hello", model="gemini-3.1-flash-lite"
    )

    assert result.completion_tokens == 30
    assert result.raw_metadata["thinking_tokens"] == 0
    assert result.cost_usd == 0.000095
