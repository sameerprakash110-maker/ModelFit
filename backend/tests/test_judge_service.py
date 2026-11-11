import asyncio
import json
import pytest
from app.services.judge_service import JudgeService


def test_build_judge_prompt_structure():
    """Verify that prompt builder injects system prompt, rubric, output schema, and expected behavior."""
    prompt = JudgeService._build_judge_prompt(
        candidate_response="def fib(n): return n",
        expected_behavior="Return n-th Fibonacci number",
        evaluation_criteria={"correctness": "Accurate for n >= 0"},
        system_prompt="You are a Python programming mentor.",
        rubric={"10": "Flawless solution", "0": "Incorrect"},
        output_schema={"type": "string"},
    )

    assert "PROJECT SYSTEM PROMPT:" in prompt
    assert "PROJECT SCORING RUBRIC:" in prompt
    assert "EXPECTED OUTPUT SCHEMA:" in prompt
    assert "EXPECTED BEHAVIOR / GROUND TRUTH:" in prompt
    assert "TEST CASE EVALUATION CRITERIA:" in prompt
    assert "CANDIDATE MODEL RESPONSE:" in prompt
    assert "def fib(n): return n" in prompt


def test_parse_judge_response_clean_json():
    """Verify parsing clean JSON response from judge model."""
    raw = json.dumps({
        "score": 8.5,
        "reasoning": "Well-structured response fulfilling all criteria.",
        "criteria_met": {
            "correctness": True,
            "relevance": True,
            "completeness": True,
            "instruction_adherence": True,
            "no_hallucination": True,
            "format_compliance": True,
        },
    })

    parsed = JudgeService._parse_judge_response(raw)
    assert parsed["score"] == 8.5
    assert parsed["reasoning"] == "Well-structured response fulfilling all criteria."
    assert parsed["criteria_met"]["correctness"] is True


def test_parse_judge_response_markdown_wrapped():
    """Verify parsing response wrapped inside markdown ```json ... ``` blocks."""
    raw = (
        "Here is the evaluation result:\n\n"
        "```json\n"
        "{\n"
        '  "score": 7.0,\n'
        '  "reasoning": "Mostly correct with minor omissions.",\n'
        '  "criteria_met": {"correctness": true, "relevance": true}\n'
        "}\n"
        "```\n"
    )

    parsed = JudgeService._parse_judge_response(raw)
    assert parsed["score"] == 7.0
    assert "Mostly correct" in parsed["reasoning"]
    assert parsed["criteria_met"]["correctness"] is True


def test_parse_judge_response_invalid_json_raises():
    """Verify invalid JSON raises ValueError with informative message."""
    raw = "Not a json response at all."
    with pytest.raises(ValueError, match="Judge output was not valid JSON"):
        JudgeService._parse_judge_response(raw)


def test_parse_judge_response_missing_score_raises():
    """Verify response missing 'score' field raises ValueError."""
    raw = json.dumps({"reasoning": "Missing score field"})
    with pytest.raises(ValueError, match="missing required 'score' field"):
        JudgeService._parse_judge_response(raw)


def test_parse_judge_response_non_numeric_score_raises():
    """Verify non-numeric score raises ValueError."""
    raw = json.dumps({"score": "excellent", "reasoning": "Very good"})
    with pytest.raises(ValueError, match="Judge score must be numeric"):
        JudgeService._parse_judge_response(raw)


def test_parse_judge_response_clamps_bounds():
    """Verify score out of bounds is clamped between 0.0 and 10.0."""
    raw_high = json.dumps({"score": 15.0, "reasoning": "Off the charts"})
    assert JudgeService._parse_judge_response(raw_high)["score"] == 10.0

    raw_low = json.dumps({"score": -5.0, "reasoning": "Terrible"})
    assert JudgeService._parse_judge_response(raw_low)["score"] == 0.0


@pytest.mark.asyncio
async def test_judge_disabled_mode():
    """Verify that disabled judging returns status='skipped' without invoking providers."""
    res = await JudgeService.evaluate(
        candidate_response="Some candidate output",
        expected_behavior="Expected output",
        enabled=False,
    )
    assert res["status"] == "skipped"
    assert res["score"] is None
    assert "skipped" in res["reasoning"].lower()


@pytest.mark.asyncio
async def test_judge_mock_evaluation_mode():
    """Verify that mock mode produces deterministic scores without API calls."""
    res = await JudgeService.evaluate(
        candidate_response="The capital of Germany is Berlin.",
        expected_behavior="Berlin is the capital of Germany.",
        mock=True,
    )
    assert res["status"] == "completed"
    assert res["score"] is not None
    assert 6.0 <= res["score"] <= 10.0
    assert "criteria_met" in res
    assert "[Mock Judge]" in res["reasoning"]


@pytest.mark.asyncio
async def test_judge_unconfigured_provider_fails_gracefully():
    """Verify unconfigured provider returns failure status rather than inventing a score."""
    # Test registered provider without API key
    res_unconfigured = await JudgeService.evaluate(
        candidate_response="Output text",
        expected_behavior="Target text",
        judge_provider_name="gemini",  # Registered but unconfigured without key in test env
        mock=False,
    )
    assert res_unconfigured["status"] == "failed"
    assert res_unconfigured["score"] is None
    assert res_unconfigured["error_type"] in ("unconfigured_provider", "provider_error")

    # Test unregistered/unknown provider
    res_unknown = await JudgeService.evaluate(
        candidate_response="Output text",
        expected_behavior="Target text",
        judge_provider_name="openai",  # Decommissioned provider
        mock=False,
    )
    assert res_unknown["status"] == "failed"
    assert res_unknown["score"] is None
    assert res_unknown["error_type"] in ("unsupported_provider", "provider_error")


@pytest.mark.asyncio
async def test_judge_timeout_error_classification(monkeypatch):
    """Verify timeout scenario classifies as judge_timeout."""
    from unittest.mock import AsyncMock
    from app.providers.gemini import GeminiProvider

    monkeypatch.setattr(GeminiProvider, "is_configured", lambda self: True)
    async def slow_generate(*args, **kwargs):
        await asyncio.sleep(2.0)
    monkeypatch.setattr(GeminiProvider, "generate", slow_generate)

    res = await JudgeService.evaluate(
        candidate_response="Candidate answer",
        expected_behavior="Expected answer",
        judge_provider_name="gemini",
        timeout_seconds=0.01,
        mock=False,
    )
    assert res["status"] == "failed"
    assert res["error_type"] == "judge_timeout"
    assert "timed out" in res["reasoning"].lower()


@pytest.mark.asyncio
async def test_judge_invalid_json_classification(monkeypatch):
    """Verify unparseable judge output classifies as invalid_judge_response."""
    from app.providers.base import ProviderResult
    from app.providers.gemini import GeminiProvider

    monkeypatch.setattr(GeminiProvider, "is_configured", lambda self: True)
    async def invalid_output(*args, **kwargs):
        return ProviderResult(
            content="This is completely invalid and not JSON at all.",
            model="gemini-3.1-flash-lite",
            provider="gemini",
        )
    monkeypatch.setattr(GeminiProvider, "generate", invalid_output)

    res = await JudgeService.evaluate(
        candidate_response="Candidate answer",
        expected_behavior="Expected answer",
        judge_provider_name="gemini",
        mock=False,
    )
    assert res["status"] == "failed"
    assert res["error_type"] == "invalid_judge_response"
    assert res["score"] is None
