from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.exceptions import EntityNotFoundException
from app.models.benchmark import Benchmark
from app.models.evaluation import Evaluation
from app.schemas.evaluation import EvaluationCreate
from app.utils.logger import logger


class EvaluationService:
    """Evaluation Service with LLM-as-a-Judge and scoring pipeline extension points.

    Architectural placeholder for:
    - Running LLM-as-a-Judge automated scoring against ground truth or evaluation criteria.
    - Aggregating latency, cost, and qualitative performance metrics.
    - Storing and querying evaluation records.
    """

    @staticmethod
    def get_evaluations_for_benchmark(
        db: Session,
        benchmark_id: str,
    ) -> List[Evaluation]:
        """Fetch all evaluations associated with a given benchmark."""
        query = (
            select(Evaluation)
            .where(Evaluation.benchmark_id == benchmark_id)
            .order_by(Evaluation.created_at.desc())
        )
        return list(db.scalars(query).all())

    @staticmethod
    def record_evaluation(
        db: Session,
        evaluation_in: EvaluationCreate,
    ) -> Evaluation:
        """Persist a single model evaluation result."""
        # Verify benchmark exists
        benchmark = db.scalars(
            select(Benchmark).where(Benchmark.id == evaluation_in.benchmark_id)
        ).first()
        if not benchmark:
            raise EntityNotFoundException("Benchmark", evaluation_in.benchmark_id)

        evaluation = Evaluation(
            benchmark_id=evaluation_in.benchmark_id,
            test_case_id=evaluation_in.test_case_id,
            model_name=evaluation_in.model_name,
            provider_name=evaluation_in.provider_name,
            prompt_tokens=evaluation_in.prompt_tokens,
            completion_tokens=evaluation_in.completion_tokens,
            total_cost=evaluation_in.total_cost,
            latency_ms=evaluation_in.latency_ms,
            judge_score=evaluation_in.judge_score,
            response_text=evaluation_in.response_text,
            status=evaluation_in.status,
        )
        db.add(evaluation)
        db.commit()
        db.refresh(evaluation)
        logger.info(f"Recorded evaluation {evaluation.id} for benchmark {evaluation.benchmark_id}")
        return evaluation

    @classmethod
    async def evaluate_with_judge(
        cls,
        candidate_response: str,
        expected_behavior: Optional[str],
        evaluation_criteria: Optional[str],
        judge_model: str = "gemini-1.5-pro",
    ) -> Dict[str, Any]:
        """Extension point: Automated LLM-as-a-Judge assessment.

        Future implementation will use a designated judge model to score adherence,
        hallucination, and reasoning quality.
        """
        # Placeholder architectural stub
        return {
            "judge_model": judge_model,
            "score": 8.5,
            "reasoning": "Candidate response satisfies expected behavior criteria (Placeholder score).",
            "is_placeholder": True,
        }
