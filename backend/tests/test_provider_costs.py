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

    def raise_for_status(self):
        pass

    def json(self):
        return {
            "candidates": [
                {"content": {"parts": [{"text": "Generated response"}]}, "finishReason": "STOP"}
            ],
            "usageMetadata": {
                "promptTokenCount": 200,
                "candidatesTokenCount": 30,
            },
        }


class FakeAsyncClient:
    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def post(self, *args, **kwargs):
        return FakeResponse()


@pytest.mark.asyncio
async def test_gemini_generation_reports_cost_from_usage_metadata(monkeypatch):
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
