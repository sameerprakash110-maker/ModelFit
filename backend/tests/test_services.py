import pytest
from app.services.cost_service import CostService
from app.services.evaluation_service import EvaluationService
from app.services.prompt_healer_service import PromptHealerService
from app.services.reliability_service import ReliabilityService
from app.services.roi_service import ROIService


def test_cost_calculation():
    """Verify token pricing calculations for known models and fallback defaults."""
    # Gemini 1.5 Pro: $1.25 / 1M prompt, $5.00 / 1M completion
    # 10,000 prompt tokens = 0.0125, 2,000 completion tokens = 0.01
    cost = CostService.calculate_cost("gemini-1.5-pro", prompt_tokens=10_000, completion_tokens=2_000)
    assert cost == 0.0225

    # Groq Llama 3.1 8B: $0.05 / 1M prompt, $0.08 / 1M completion
    groq_cost = CostService.calculate_cost("llama-3.1-8b-instant", prompt_tokens=100_000, completion_tokens=100_000)
    assert groq_cost == 0.013


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
