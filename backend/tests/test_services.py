import pytest
from app.services.cost_service import CostService
from app.services.evaluation_service import EvaluationService
from app.services.prompt_healer_service import PromptHealerService
from app.services.reliability_service import ReliabilityService
from app.services.roi_service import ROIService


def test_cost_calculation():
    """Verify token pricing calculations for supported models."""

    # Gemini 1.5 Pro
    cost = CostService.calculate_cost(
        "gemini-1.5-pro",
        prompt_tokens=10_000,
        completion_tokens=2_000,
    )

    assert cost == 0.0225

    # Groq GPT-OSS 20B
    groq_cost = CostService.calculate_cost(
        "openai/gpt-oss-20b",
        prompt_tokens=100_000,
        completion_tokens=100_000,
    )

    assert groq_cost == 0.0375

    # Unknown model should return None
    unknown_cost = CostService.calculate_cost(
        "unknown-model",
        prompt_tokens=1000,
        completion_tokens=500,
    )

    assert unknown_cost is None


@pytest.mark.asyncio
async def test_future_service_extension_points():
    """Verify that architectural placeholders are callable and return structured dictionaries."""
    # LLM Judge placeholder
    judge_res = await EvaluationService.evaluate_with_judge(
        candidate_response="The capital of France is Paris.",
        expected_behavior="Identifies Paris as the capital.",
        evaluation_criteria="Factual correctness",
    )
    assert "score" in judge_res
    assert judge_res["is_placeholder"] is True

    # Prompt Healer placeholder
    healer_res = await PromptHealerService.analyze_and_heal(
        original_prompt="Summarize this text.",
        failed_cases=[{"error": "Too verbose"}],
    )
    assert "optimized_prompt" in healer_res
    assert healer_res["is_placeholder"] is True

    # Reliability Engine placeholder
    rel_res = await ReliabilityService.measure_consistency(
        model_name="gpt-4o",
        prompt="Tell me a joke.",
        iterations=3,
    )
    assert "consistency_score" in rel_res
    assert rel_res["is_placeholder"] is True

    # ROI Engine placeholder
    roi_res = ROIService.generate_recommendation(
        benchmark_results=[],
        project_monthly_volume=50_000,
    )
    assert "recommended_primary_model" in roi_res
    assert roi_res["is_placeholder"] is True
