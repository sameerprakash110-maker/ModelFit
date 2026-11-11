import asyncio
from datetime import datetime, timezone
from decimal import Decimal
import time
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.exceptions import EntityNotFoundException, ValidationException
from app.models.benchmark import Benchmark
from app.models.project import Project
from app.models.test_case import TestCase
from app.providers import PROVIDER_CLASSES, get_provider
from app.providers.registry import get_all_providers, initialize_providers
from app.schemas.benchmark import (
    BenchmarkCreate,
    BenchmarkExecutionSummary,
    BenchmarkUpdate,
)
from app.schemas.evaluation import EvaluationAttemptCreate, EvaluationCreate
from app.services.cost_service import CostService
from app.services.evaluation_service import EvaluationService
from app.services.judge_service import JudgeService
from app.services.test_case_service import TestCaseService
from app.utils.logger import logger

VALID_STATUSES = {"pending", "running", "completed", "failed"}


class BenchmarkService:
    """Service layer managing benchmark lifecycle, configuration, and execution orchestration."""

    @staticmethod
    def get_benchmarks(
        db: Session,
        project_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Benchmark]:
        """Fetch a paginated list of benchmarks, optionally filtered by project_id."""
        query = select(Benchmark).order_by(Benchmark.created_at.desc())
        if project_id:
            query = query.where(Benchmark.project_id == project_id)
        return list(db.scalars(query.offset(skip).limit(limit)).all())

    @staticmethod
    def get_benchmark_by_id(db: Session, benchmark_id: str) -> Optional[Benchmark]:
        """Fetch benchmark by ID."""
        query = select(Benchmark).where(Benchmark.id == benchmark_id)
        return db.scalars(query).first()

    @staticmethod
    def get_benchmark_or_404(db: Session, benchmark_id: str) -> Benchmark:
        """Fetch benchmark by ID or raise EntityNotFoundException."""
        benchmark = BenchmarkService.get_benchmark_by_id(db, benchmark_id)
        if not benchmark:
            raise EntityNotFoundException("Benchmark", benchmark_id)
        return benchmark

    @staticmethod
    def create_benchmark(db: Session, benchmark_in: BenchmarkCreate) -> Benchmark:
        """Create and persist a new benchmark for an existing project."""
        project = db.scalars(select(Project).where(Project.id == benchmark_in.project_id)).first()
        if not project:
            raise EntityNotFoundException("Project", benchmark_in.project_id)

        if not benchmark_in.selected_models:
            raise ValidationException("At least one model must be selected for benchmarking.")

        benchmark = Benchmark(
            project_id=benchmark_in.project_id,
            name=benchmark_in.name,
            description=benchmark_in.description,
            selected_models=benchmark_in.selected_models,
            baseline_model=benchmark_in.baseline_model,
            repeats=benchmark_in.repeats,
            status="pending",
        )
        db.add(benchmark)
        db.commit()
        db.refresh(benchmark)
        logger.info(f"Created benchmark: {benchmark.id} for project {benchmark.project_id}")
        return benchmark

    @staticmethod
    def update_benchmark(
        db: Session, benchmark_id: str, benchmark_in: BenchmarkUpdate
    ) -> Benchmark:
        """Update an existing benchmark's metadata or status."""
        benchmark = BenchmarkService.get_benchmark_or_404(db, benchmark_id)

        if benchmark_in.status is not None:
            if benchmark_in.status not in VALID_STATUSES:
                raise ValidationException(
                    f"Invalid status '{benchmark_in.status}'. Must be one of: {', '.join(VALID_STATUSES)}"
                )
            benchmark.status = benchmark_in.status

        if benchmark_in.name is not None:
            benchmark.name = benchmark_in.name
        if benchmark_in.description is not None:
            benchmark.description = benchmark_in.description
        if benchmark_in.baseline_model is not None:
            benchmark.baseline_model = benchmark_in.baseline_model
        if benchmark_in.repeats is not None:
            benchmark.repeats = benchmark_in.repeats

        db.add(benchmark)
        db.commit()
        db.refresh(benchmark)
        return benchmark

    @classmethod
    def resolve_provider_for_model(cls, model_name: str) -> str:
        """Resolve the appropriate AI provider for a model name using the authoritative registry."""
        normalized = model_name.strip()

        # Query authoritative registered providers
        active_providers = get_all_providers()
        if not active_providers:
            initialize_providers()
            active_providers = get_all_providers()

        for provider_key, provider_inst in active_providers.items():
            if normalized in provider_inst.supported_models:
                return provider_key

        raise ValidationException(
            f"Unable to resolve provider for model '{model_name}'. "
            f"Supported models must be registered in an active provider."
        )

    @classmethod
    async def _execute_single_evaluation(
        cls,
        benchmark_id: str,
        test_case: TestCase,
        project_system_prompt: str,
        project_rubric: Optional[Dict[str, Any]],
        project_output_schema: Optional[Dict[str, Any]],
        model_name: str,
        provider_name: str,
        repeat_index: int,
        mock: bool,
        judge_enabled: bool,
        judge_provider: Optional[str],
        judge_model: Optional[str],
        semaphore: asyncio.Semaphore,
        session_factory: Any,
        max_retries: int = 2,
    ) -> bool:
        """Execute a single model x test-case x repeat evaluation with retries and persistence."""
        async with semaphore:
            attempts: List[EvaluationAttemptCreate] = []
            candidate_response_text: Optional[str] = None
            candidate_success = False

            try:
                provider = get_provider(provider_name)
            except Exception as exc:
                err_msg = f"Provider '{provider_name}' is not registered or unavailable: {exc}"
                logger.error(f"Cannot resolve provider instance for '{provider_name}': {exc}")
                attempts.append(
                    EvaluationAttemptCreate(
                        attempt_number=1,
                        input_tokens=0,
                        output_tokens=0,
                        latency_ms=0.0,
                        execution_cost=Decimal("0"),
                        is_mock=mock,
                        error_type="provider_unavailable",
                        error_message=err_msg,
                    )
                )
                provider = None

            if provider is not None:
                # Check if provider has configured credentials (unless in mock simulation)
                if not mock and not provider.is_configured():
                    err_msg = f"Provider '{provider_name}' is not configured with an API key."
                    logger.warning(f"Evaluation for {model_name} failed: {err_msg}")
                    attempts.append(
                        EvaluationAttemptCreate(
                            attempt_number=1,
                            input_tokens=0,
                            output_tokens=0,
                            latency_ms=0.0,
                            execution_cost=Decimal("0"),
                            is_mock=mock,
                            error_type="unconfigured_provider",
                            error_message=err_msg,
                        )
                    )
                else:
                    # Retries loop for model generation
                    for attempt_num in range(1, max_retries + 1):
                        start_time = time.perf_counter()
                        try:
                            result = await provider.generate(
                                prompt=test_case.input_prompt,
                                model=model_name,
                                system_prompt=project_system_prompt,
                                mock=mock,
                            )
                            latency = (time.perf_counter() - start_time) * 1000

                            # Calculate USD cost from token counts
                            cost = CostService.calculate_cost(
                                model_name=model_name,
                                prompt_tokens=result.prompt_tokens,
                                completion_tokens=result.completion_tokens,
                            )

                            attempts.append(
                                EvaluationAttemptCreate(
                                    attempt_number=attempt_num,
                                    input_tokens=result.prompt_tokens,
                                    output_tokens=result.completion_tokens,
                                    latency_ms=round(latency, 2),
                                    execution_cost=Decimal(str(cost)) if cost is not None else Decimal("0"),
                                    is_mock=mock,
                                    error_type=None,
                                    error_message=None,
                                )
                            )
                            candidate_response_text = result.content
                            candidate_success = True
                            break

                        except Exception as exc:
                            latency = (time.perf_counter() - start_time) * 1000
                            err_msg = str(exc)
                            if "key" in err_msg.lower():
                                err_msg = "Provider API credential or network failure."

                            attempts.append(
                                EvaluationAttemptCreate(
                                    attempt_number=attempt_num,
                                    input_tokens=0,
                                    output_tokens=0,
                                    latency_ms=round(latency, 2),
                                    execution_cost=Decimal("0"),
                                    is_mock=mock,
                                    error_type="api_error",
                                    error_message=err_msg,
                                )
                            )
                            logger.warning(
                                f"Attempt {attempt_num}/{max_retries} failed for {model_name} on test case {test_case.id}: {err_msg}"
                            )
                            if attempt_num < max_retries:
                                await asyncio.sleep(0.5 * attempt_num)

            # Qualitative judging
            judge_score: Optional[float] = None
            judge_reasoning: Optional[str] = None

            if candidate_success and candidate_response_text:
                if judge_enabled:
                    judge_res = await JudgeService.evaluate(
                        candidate_response=candidate_response_text,
                        expected_behavior=test_case.expected_behavior,
                        evaluation_criteria=test_case.evaluation_criteria,
                        system_prompt=project_system_prompt,
                        rubric=project_rubric,
                        output_schema=project_output_schema,
                        judge_provider_name=judge_provider,
                        judge_model=judge_model,
                        mock=mock,
                        enabled=True,
                    )
                    judge_score = judge_res.get("score")
                    judge_reasoning = judge_res.get("reasoning")
                else:
                    judge_reasoning = "LLM-as-a-Judge evaluation disabled."
            else:
                judge_reasoning = "Candidate model generation failed across all retry attempts."

            # Calculate evaluation-level aggregations
            total_input_tokens = sum(a.input_tokens for a in attempts)
            total_output_tokens = sum(a.output_tokens for a in attempts)
            total_cost = sum((Decimal(str(a.execution_cost)) for a in attempts), Decimal("0"))
            total_latency = sum(a.latency_ms for a in attempts)

            evaluation_in = EvaluationCreate(
                benchmark_id=benchmark_id,
                test_case_id=test_case.id,
                model_name=model_name,
                provider_name=provider_name,
                input_tokens=total_input_tokens,
                output_tokens=total_output_tokens,
                execution_cost=total_cost,
                latency_ms=round(total_latency, 2),
                quality_score=judge_score,
                response_text=candidate_response_text,
                status="completed" if candidate_success else "failed",
                attempt_count=len(attempts),
                repeat_index=repeat_index,
                prompt_version="original",
                judge_reasoning=judge_reasoning,
                is_mock=mock,
            )

            # Persist under a short-lived synchronous database session
            with session_factory() as db_session:
                EvaluationService.record_evaluation(
                    db=db_session,
                    evaluation_in=evaluation_in,
                    attempts=attempts,
                )

            return candidate_success

    @classmethod
    async def run_benchmark(
        cls,
        benchmark_id: str,
        mock: bool = False,
        judge_enabled: bool = True,
        max_concurrency: int = 5,
        judge_provider: Optional[str] = None,
        judge_model: Optional[str] = None,
        db: Optional[Session] = None,
        session_factory: Any = None,
    ) -> BenchmarkExecutionSummary:
        """Orchestrate end-to-end benchmark execution across models, test cases, and repeats."""
        from sqlalchemy.orm import sessionmaker

        if session_factory is None:
            if db is not None:
                session_factory = sessionmaker(
                    bind=db.get_bind(),
                    autocommit=False,
                    autoflush=False,
                    expire_on_commit=False,
                )
            else:
                session_factory = SessionLocal

        # 1. Validation & initial state transition
        with session_factory() as local_db:
            benchmark = BenchmarkService.get_benchmark_or_404(local_db, benchmark_id)

            if benchmark.status == "running":
                raise ValidationException("Benchmark is already currently executing.")
            if benchmark.status == "completed":
                raise ValidationException("Benchmark has already completed execution.")

            if not benchmark.selected_models:
                raise ValidationException("Benchmark has no models selected for evaluation.")

            project = local_db.scalars(select(Project).where(Project.id == benchmark.project_id)).first()
            if not project:
                raise EntityNotFoundException("Project", benchmark.project_id)

            test_cases = TestCaseService.list_test_cases_for_project(local_db, project.id)
            if not test_cases:
                raise ValidationException(
                    f"Project '{project.id}' has no test cases to benchmark."
                )

            # Verify all selected models resolve to a provider
            model_provider_map = {}
            for m in benchmark.selected_models:
                model_provider_map[m] = cls.resolve_provider_for_model(m)

            # Transition status to running
            benchmark.status = "running"
            local_db.add(benchmark)
            local_db.commit()

            # Cache required project data to avoid open transactions
            project_sys_prompt = project.system_prompt
            project_rubric = project.rubric
            project_output_schema = project.output_schema
            selected_models = list(benchmark.selected_models)
            repeats = benchmark.repeats

        # 2. Build execution matrix
        semaphore = asyncio.Semaphore(max_concurrency)
        tasks = []

        for model_name in selected_models:
            provider_name = model_provider_map[model_name]
            for test_case in test_cases:
                for repeat_idx in range(repeats):
                    tasks.append(
                        cls._execute_single_evaluation(
                            benchmark_id=benchmark_id,
                            test_case=test_case,
                            project_system_prompt=project_sys_prompt,
                            project_rubric=project_rubric,
                            project_output_schema=project_output_schema,
                            model_name=model_name,
                            provider_name=provider_name,
                            repeat_index=repeat_idx,
                            mock=mock,
                            judge_enabled=judge_enabled,
                            judge_provider=judge_provider,
                            judge_model=judge_model,
                            semaphore=semaphore,
                            session_factory=session_factory,
                        )
                    )

        # 3. Execute concurrently with bounded concurrency
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # 4. Finalize benchmark status & aggregate results
        with session_factory() as local_db:
            benchmark = BenchmarkService.get_benchmark_or_404(local_db, benchmark_id)
            evaluations = EvaluationService.get_evaluations_for_benchmark(local_db, benchmark_id)

            total_evals = len(evaluations)
            successful_evals = sum(1 for e in evaluations if e.status == "completed")
            failed_evals = sum(1 for e in evaluations if e.status == "failed")
            total_attempts = sum(e.attempt_count for e in evaluations)
            total_cost = sum((float(e.execution_cost) for e in evaluations), 0.0)

            latencies = [e.latency_ms for e in evaluations if e.latency_ms is not None]
            avg_latency = round(sum(latencies) / len(latencies), 2) if latencies else 0.0

            quality_scores = [e.quality_score for e in evaluations if e.quality_score is not None]
            avg_quality = (
                round(sum(quality_scores) / len(quality_scores), 2) if quality_scores else None
            )

            # Determine final status: Never mark completed if 0 inferences succeeded
            if successful_evals > 0:
                benchmark.status = "completed"
            else:
                benchmark.status = "failed"

            completed_at = datetime.now(timezone.utc)
            benchmark.completed_at = completed_at
            local_db.add(benchmark)
            local_db.commit()

            message = (
                f"Benchmark execution {benchmark.status}: {successful_evals}/{total_evals} "
                f"evaluations succeeded across {len(selected_models)} models."
            )

            return BenchmarkExecutionSummary(
                benchmark_id=benchmark_id,
                status=benchmark.status,
                total_evaluations=total_evals,
                successful_evaluations=successful_evals,
                failed_evaluations=failed_evals,
                total_attempts=total_attempts,
                total_cost_usd=round(total_cost, 6),
                average_latency_ms=avg_latency,
                average_quality_score=avg_quality,
                completed_at=completed_at,
                is_mock=mock,
                message=message,
            )

    @classmethod
    def recover_benchmark(
        cls,
        db: Session,
        benchmark_id: str,
    ) -> Benchmark:
        """Safely recover an abandoned benchmark trapped in 'running' state after a crash or timeout.

        Inspects completed evaluation records:
        - If >= 1 evaluations succeeded, completes the benchmark based on empirical results.
        - If 0 evaluations succeeded or none were recorded, marks the benchmark failed.
        """
        benchmark = BenchmarkService.get_benchmark_or_404(db, benchmark_id)
        if benchmark.status != "running":
            return benchmark

        evaluations = EvaluationService.get_evaluations_for_benchmark(db, benchmark_id)
        successful_evals = sum(1 for e in evaluations if e.status == "completed")

        completed_at = datetime.now(timezone.utc)
        benchmark.completed_at = completed_at

        if successful_evals > 0:
            benchmark.status = "completed"
            recovery_note = f"[Recovered: {successful_evals}/{len(evaluations)} evaluations completed]"
        else:
            benchmark.status = "failed"
            recovery_note = "[Recovered: Run interrupted before any evaluations completed]"

        if benchmark.description:
            benchmark.description = f"{benchmark.description}\n{recovery_note}"
        else:
            benchmark.description = recovery_note

        db.add(benchmark)
        db.commit()
        db.refresh(benchmark)
        logger.info(f"Recovered abandoned benchmark {benchmark.id}: status transitioned to '{benchmark.status}'.")
        return benchmark

    @classmethod
    def recover_abandoned_benchmarks(
        cls,
        db: Session,
    ) -> List[Benchmark]:
        """Find and reconcile all abandoned benchmarks left in 'running' status across server restarts."""
        query = select(Benchmark).where(Benchmark.status == "running")
        abandoned = list(db.scalars(query).all())
        recovered = []
        for b in abandoned:
            rec = cls.recover_benchmark(db, b.id)
            recovered.append(rec)
        if recovered:
            logger.info(f"Reconciled {len(recovered)} abandoned benchmark(s) on startup.")
        return recovered
