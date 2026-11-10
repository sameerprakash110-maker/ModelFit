import asyncio
import json
import re
from typing import Any, Dict, Optional
from app.providers import get_provider
from app.utils.logger import logger

JUDGE_SYSTEM_PROMPT = """You are an expert impartial AI evaluator judging candidate LLM responses against benchmark specifications.

You must objectively evaluate the candidate model's response on six dimensions:
1. Correctness: Factual accuracy against expected behavior.
2. Relevance: Directness in addressing the prompt without tangent or filler.
3. Completeness: Thoroughness in fulfilling all aspects of the request.
4. Instruction adherence: Strict compliance with system and user guidelines.
5. Hallucination check: Absence of fabricated or unsupported claims.
6. Output format compliance: Conformance with expected output schema or format.

Respond ONLY with a valid, parseable JSON object without markdown formatting, comments, or extra text:
{
  "score": <numeric score from 0.0 to 10.0>,
  "reasoning": "<concise narrative justifying the score>",
  "criteria_met": {
    "correctness": <true|false>,
    "relevance": <true|false>,
    "completeness": <true|false>,
    "instruction_adherence": <true|false>,
    "no_hallucination": <true|false>,
    "format_compliance": <true|false>
  }
}
"""


class JudgeService:
    """LLM-as-a-Judge evaluation engine providing automated qualitative scoring."""

    DEFAULT_PROVIDER = "gemini"
    DEFAULT_MODEL = "gemini-3.1-flash-lite"
    DEFAULT_TIMEOUT_SECONDS = 30.0

    @classmethod
    def _build_judge_prompt(
        cls,
        candidate_response: str,
        expected_behavior: str,
        evaluation_criteria: Optional[Any] = None,
        system_prompt: Optional[str] = None,
        rubric: Optional[Dict[str, Any]] = None,
        output_schema: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Construct the prompt sent to the judge model."""
        sections = []

        if system_prompt:
            sections.append(f"### PROJECT SYSTEM PROMPT:\n{system_prompt}")

        if rubric:
            sections.append(f"### PROJECT SCORING RUBRIC:\n{json.dumps(rubric, indent=2)}")

        if output_schema:
            sections.append(f"### EXPECTED OUTPUT SCHEMA:\n{json.dumps(output_schema, indent=2)}")

        sections.append(f"### EXPECTED BEHAVIOR / GROUND TRUTH:\n{expected_behavior}")

        if evaluation_criteria:
            if isinstance(evaluation_criteria, (dict, list)):
                crit_str = json.dumps(evaluation_criteria, indent=2)
            else:
                crit_str = str(evaluation_criteria)
            sections.append(f"### TEST CASE EVALUATION CRITERIA:\n{crit_str}")

        sections.append(f"### CANDIDATE MODEL RESPONSE:\n{candidate_response}")

        sections.append("Evaluate the candidate response and return the required JSON evaluation object.")
        return "\n\n".join(sections)

    @classmethod
    def _parse_judge_response(cls, raw_content: str) -> Dict[str, Any]:
        """Safely parse and validate the JSON output from the judge model."""
        content = raw_content.strip()

        # Extract markdown ```json ... ``` blocks if present
        match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", content, re.DOTALL)
        if match:
            content = match.group(1).strip()
        else:
            # Fallback: extract outermost JSON object { ... }
            brace_match = re.search(r"(\{.*\})", content, re.DOTALL)
            if brace_match:
                content = brace_match.group(1).strip()

        try:
            data = json.loads(content)
        except json.JSONDecodeError as err:
            raise ValueError(f"Judge output was not valid JSON: {err}. Raw output: {raw_content[:200]}") from err

        if not isinstance(data, dict):
            raise ValueError("Judge output must be a JSON dictionary.")

        raw_score = data.get("score")
        if raw_score is None:
            raise ValueError("Judge output missing required 'score' field.")

        try:
            score = float(raw_score)
        except (ValueError, TypeError) as err:
            raise ValueError(f"Judge score must be numeric, got: {raw_score}") from err

        score = max(0.0, min(10.0, round(score, 2)))

        reasoning = str(data.get("reasoning", "")).strip()
        if not reasoning:
            reasoning = "No reasoning provided by judge."

        criteria_met = data.get("criteria_met")
        if not isinstance(criteria_met, dict):
            criteria_met = {
                "correctness": score >= 5.0,
                "relevance": score >= 5.0,
                "completeness": score >= 5.0,
                "instruction_adherence": score >= 5.0,
                "no_hallucination": score >= 5.0,
                "format_compliance": score >= 5.0,
            }

        return {
            "score": score,
            "reasoning": reasoning,
            "criteria_met": criteria_met,
        }

    @classmethod
    def _mock_evaluate(
        cls,
        candidate_response: str,
        expected_behavior: str,
        judge_model: str,
    ) -> Dict[str, Any]:
        """Generate deterministic evaluation for mock runs without live API calls."""
        # Check basic heuristics against expected behavior
        candidate_lower = candidate_response.lower()
        expected_lower = expected_behavior.lower()

        # Token overlap approximation
        expected_words = set(re.findall(r"\w+", expected_lower))
        candidate_words = set(re.findall(r"\w+", candidate_lower))

        overlap = len(expected_words.intersection(candidate_words))
        overlap_ratio = overlap / max(1, len(expected_words))

        base_score = 6.0 + min(4.0, overlap_ratio * 4.0)
        score = round(base_score, 1)

        criteria = {
            "correctness": score >= 7.0,
            "relevance": True,
            "completeness": score >= 6.5,
            "instruction_adherence": True,
            "no_hallucination": True,
            "format_compliance": True,
        }

        return {
            "score": score,
            "reasoning": (
                f"[Mock Judge] Evaluated content overlap ({len(expected_words)} terms). "
                f"Candidate achieved {score}/10 based on expected behavior alignment."
            ),
            "criteria_met": criteria,
            "status": "completed",
            "judge_model": judge_model,
            "error_type": None,
            "is_placeholder": False,
        }

    @classmethod
    async def evaluate(
        cls,
        candidate_response: str,
        expected_behavior: str,
        evaluation_criteria: Optional[Any] = None,
        system_prompt: Optional[str] = None,
        rubric: Optional[Dict[str, Any]] = None,
        output_schema: Optional[Dict[str, Any]] = None,
        judge_provider_name: Optional[str] = None,
        judge_model: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
        mock: bool = False,
        enabled: bool = True,
    ) -> Dict[str, Any]:
        """Perform qualitative evaluation of candidate LLM output.

        Returns a structured dictionary with score, reasoning, criteria_met, status, and judge_model.
        """
        model_name = judge_model or cls.DEFAULT_MODEL
        provider_name = judge_provider_name or cls.DEFAULT_PROVIDER
        timeout = timeout_seconds or cls.DEFAULT_TIMEOUT_SECONDS

        if not enabled:
            return {
                "score": None,
                "reasoning": "LLM-as-a-Judge evaluation skipped by configuration.",
                "criteria_met": {},
                "status": "skipped",
                "judge_model": model_name,
                "error_type": None,
            }

        if mock:
            return cls._mock_evaluate(
                candidate_response=candidate_response,
                expected_behavior=expected_behavior,
                judge_model=model_name,
            )

        try:
            provider = get_provider(provider_name)
        except Exception as e:
            logger.warning(f"Judge provider '{provider_name}' unavailable: {e}")
            return {
                "score": None,
                "reasoning": f"Judge provider '{provider_name}' unavailable.",
                "criteria_met": {},
                "status": "failed",
                "judge_model": model_name,
                "error_type": "provider_unavailable",
            }

        if not provider.is_configured():
            logger.warning(f"Judge provider '{provider_name}' is not configured with an API key.")
            return {
                "score": None,
                "reasoning": f"Judge provider '{provider_name}' has no API key configured.",
                "criteria_met": {},
                "status": "failed",
                "judge_model": model_name,
                "error_type": "unconfigured_provider",
            }

        prompt = cls._build_judge_prompt(
            candidate_response=candidate_response,
            expected_behavior=expected_behavior,
            evaluation_criteria=evaluation_criteria,
            system_prompt=system_prompt,
            rubric=rubric,
            output_schema=output_schema,
        )

        try:
            result = await asyncio.wait_for(
                provider.generate(
                    prompt=prompt,
                    model=model_name,
                    system_prompt=JUDGE_SYSTEM_PROMPT,
                    mock=False,
                ),
                timeout=timeout,
            )

            parsed = cls._parse_judge_response(result.content)
            return {
                "score": parsed["score"],
                "reasoning": parsed["reasoning"],
                "criteria_met": parsed["criteria_met"],
                "status": "completed",
                "judge_model": model_name,
                "error_type": None,
            }
        except asyncio.TimeoutError:
            logger.error(f"Judge evaluation timed out after {timeout} seconds.")
            return {
                "score": None,
                "reasoning": f"Judge evaluation timed out after {timeout}s.",
                "criteria_met": {},
                "status": "failed",
                "judge_model": model_name,
                "error_type": "timeout",
            }
        except ValueError as val_err:
            logger.error(f"Judge response parsing failed: {val_err}")
            return {
                "score": None,
                "reasoning": f"Judge response parsing failed: {val_err}",
                "criteria_met": {},
                "status": "failed",
                "judge_model": model_name,
                "error_type": "invalid_response_format",
            }
        except Exception as exc:
            # Sanitize error to avoid leaking credentials
            err_msg = str(exc)
            if "key" in err_msg.lower():
                err_msg = "Provider API error encountered."
            logger.error(f"Judge execution error: {err_msg}")
            return {
                "score": None,
                "reasoning": f"Judge evaluation error: {err_msg}",
                "criteria_met": {},
                "status": "failed",
                "judge_model": model_name,
                "error_type": "provider_error",
            }
