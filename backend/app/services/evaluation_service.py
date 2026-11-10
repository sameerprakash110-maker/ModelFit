from decimal import Decimal
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from app.core.exceptions import EntityNotFoundException
from app.models.benchmark import Benchmark
from app.models.evaluation import Evaluation
from app.models.evaluation_attempt import EvaluationAttempt
from app.schemas.evaluation import EvaluationAttemptCreate, EvaluationCreate
from app.utils.logger import logger


class EvaluationService:
    """Evaluation Service managing persistence of evaluations and attempt records."""

    @staticmethod
    def get_evaluations_for_benchmark(
        db: Session,
        benchmark_id: str,
        test_case_id: Optional[str] = None,
        model_name: Optional[str] = None,
    ) -> List[Evaluation]:
        """Fetch evaluations for a benchmark, optionally filtered by test case or model."""
        query = (
            select(Evaluation)
            .where(Evaluation.benchmark_id == benchmark_id)
            .order_by(Evaluation.created_at.desc())
        )
        if test_case_id:
            query = query.where(Evaluation.test_case_id == test_case_id)
        if model_name:
            query = query.where(Evaluation.model_name == model_name)

        return list(db.scalars(query).all())

    @staticmethod
    def get_evaluation_by_id(db: Session, evaluation_id: str) -> Optional[Evaluation]:
        """Fetch evaluation by ID."""
        query = select(Evaluation).where(Evaluation.id == evaluation_id)
        return db.scalars(query).first()

    @staticmethod
    def get_evaluation_with_attempts(db: Session, evaluation_id: str) -> Optional[Evaluation]:
        """Fetch evaluation with its associated attempts preloaded."""
        query = (
            select(Evaluation)
            .options(selectinload(Evaluation.attempts))
            .where(Evaluation.id == evaluation_id)
        )
        return db.scalars(query).first()

    @staticmethod
    def record_attempt(
        db: Session,
        attempt_in: EvaluationAttemptCreate,
        commit: bool = True,
    ) -> EvaluationAttempt:
        """Persist a single execution attempt for an evaluation."""
        if not attempt_in.evaluation_id:
            raise ValueError("evaluation_id is required to record an attempt.")

        attempt = EvaluationAttempt(
            evaluation_id=attempt_in.evaluation_id,
            attempt_number=attempt_in.attempt_number,
            input_tokens=attempt_in.input_tokens,
            output_tokens=attempt_in.output_tokens,
            latency_ms=attempt_in.latency_ms,
            execution_cost=Decimal(str(attempt_in.execution_cost)),
            error_type=attempt_in.error_type,
            error_message=attempt_in.error_message,
        )
        db.add(attempt)
        if commit:
            db.commit()
            db.refresh(attempt)
        return attempt

    @staticmethod
    def record_evaluation(
        db: Session,
        evaluation_in: EvaluationCreate,
        attempts: Optional[List[EvaluationAttemptCreate]] = None,
    ) -> Evaluation:
        """Persist a model evaluation result and its execution attempts under a safe transaction.

        Aggregates attempt-level token usage, latency, and costs into the parent evaluation
        if attempts are supplied.
        """
        # Verify benchmark exists
        benchmark = db.scalars(
            select(Benchmark).where(Benchmark.id == evaluation_in.benchmark_id)
        ).first()
        if not benchmark:
            raise EntityNotFoundException("Benchmark", evaluation_in.benchmark_id)

        # Aggregate attempt metrics if attempts are supplied
        input_tokens = evaluation_in.input_tokens
        output_tokens = evaluation_in.output_tokens
        execution_cost = Decimal(str(evaluation_in.execution_cost))
        latency_ms = evaluation_in.latency_ms
        attempt_count = evaluation_in.attempt_count

        if attempts:
            attempt_count = len(attempts)
            agg_in_tokens = sum(a.input_tokens for a in attempts)
            agg_out_tokens = sum(a.output_tokens for a in attempts)
            agg_cost = sum((Decimal(str(a.execution_cost)) for a in attempts), Decimal("0"))
            agg_latency = sum(a.latency_ms for a in attempts)

            # Use aggregated attempt totals if they exceed base values
            input_tokens = max(input_tokens, agg_in_tokens)
            output_tokens = max(output_tokens, agg_out_tokens)
            execution_cost = max(execution_cost, agg_cost)
            latency_ms = max(latency_ms, agg_latency)

        evaluation = Evaluation(
            benchmark_id=evaluation_in.benchmark_id,
            test_case_id=evaluation_in.test_case_id,
            model_name=evaluation_in.model_name,
            provider_name=evaluation_in.provider_name,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            execution_cost=execution_cost,
            latency_ms=latency_ms,
            quality_score=evaluation_in.quality_score,
            response_text=evaluation_in.response_text,
            status=evaluation_in.status,
            attempt_count=attempt_count,
            repeat_index=evaluation_in.repeat_index,
            prompt_version=evaluation_in.prompt_version,
            judge_reasoning=evaluation_in.judge_reasoning,
        )

        try:
            db.add(evaluation)
            db.flush()  # Populates evaluation.id

            if attempts:
                for att_in in attempts:
                    attempt_row = EvaluationAttempt(
                        evaluation_id=evaluation.id,
                        attempt_number=att_in.attempt_number,
                        input_tokens=att_in.input_tokens,
                        output_tokens=att_in.output_tokens,
                        latency_ms=att_in.latency_ms,
                        execution_cost=Decimal(str(att_in.execution_cost)),
                        error_type=att_in.error_type,
                        error_message=att_in.error_message,
                    )
                    db.add(attempt_row)

            db.commit()
            db.refresh(evaluation)
            logger.info(
                f"Recorded evaluation {evaluation.id} for benchmark {evaluation.benchmark_id} "
                f"({evaluation.model_name}, status: {evaluation.status})"
            )
            return evaluation
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to persist evaluation: {e}")
            raise

    @classmethod
    async def evaluate_with_judge(
        cls,
        candidate_response: str,
        expected_behavior: Optional[str] = None,
        evaluation_criteria: Optional[Any] = None,
        judge_model: str = "gemini-3.1-flash-lite",
        system_prompt: Optional[str] = None,
        rubric: Optional[Dict[str, Any]] = None,
        output_schema: Optional[Dict[str, Any]] = None,
        mock: bool = True,
    ) -> Dict[str, Any]:
        """Assess candidate response using LLM-as-a-Judge."""
        from app.services.judge_service import JudgeService

        result = await JudgeService.evaluate(
            candidate_response=candidate_response,
            expected_behavior=expected_behavior or "",
            evaluation_criteria=evaluation_criteria,
            system_prompt=system_prompt,
            rubric=rubric,
            output_schema=output_schema,
            judge_model=judge_model,
            mock=mock,
        )
        result["is_placeholder"] = True
        return result
