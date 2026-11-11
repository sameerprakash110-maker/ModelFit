import pytest
from app.core.exceptions import ValidationException
from app.models.benchmark import Benchmark
from app.models.project import Project
from app.models.test_case import TestCase
from app.services.benchmark_service import BenchmarkService
from app.services.evaluation_service import EvaluationService


def _setup_benchmark_env(db, model_list=None, num_test_cases=2, repeats=1):
    proj = Project(
        name="Orchestration Project",
        system_prompt="You are a helpful coding assistant.",
        rubric={"10": "Perfect answer", "0": "Incorrect"},
    )
    db.add(proj)
    db.flush()

    for i in range(num_test_cases):
        tc = TestCase(
            project_id=proj.id,
            input_prompt=f"Test prompt {i + 1}",
            expected_behavior=f"Expected answer {i + 1}",
            evaluation_criteria={"accuracy": "Must match target"},
        )
        db.add(tc)
    db.flush()

    models = model_list or ["gemini-3.1-flash-lite", "qwen/qwen3.8-27b"]
    bench = Benchmark(
        project_id=proj.id,
        name="Execution Benchmark",
        selected_models=models,
        repeats=repeats,
        status="pending",
    )
    db.add(bench)
    db.commit()
    db.refresh(bench)
    return bench


def test_resolve_provider_for_model():
    """Verify explicit model-to-provider resolution across active provider families."""
    assert BenchmarkService.resolve_provider_for_model("gemini-3.1-flash-lite") == "gemini"
    assert BenchmarkService.resolve_provider_for_model("gemini-3.8-flash") == "gemini"
    assert BenchmarkService.resolve_provider_for_model("qwen/qwen3.8-27b") == "groq"
    assert BenchmarkService.resolve_provider_for_model("llama-3.3-70b-versatile") == "groq"

    # Models from removed providers (OpenAI) fail resolution
    with pytest.raises(ValidationException, match="Unable to resolve provider"):
        BenchmarkService.resolve_provider_for_model("gpt-4o")

    with pytest.raises(ValidationException, match="Unable to resolve provider"):
        BenchmarkService.resolve_provider_for_model("unknown-quantum-llm-9000")


@pytest.mark.asyncio
async def test_run_benchmark_mock_e2e(db_session):
    """Verify complete end-to-end matrix execution in mock mode."""
    # 2 models x 2 test cases x 1 repeat = 4 evaluations
    bench = _setup_benchmark_env(db_session, num_test_cases=2, repeats=1)

    summary = await BenchmarkService.run_benchmark(
        benchmark_id=bench.id,
        mock=True,
        judge_enabled=True,
        max_concurrency=4,
        db=db_session,
    )

    assert summary.benchmark_id == bench.id
    assert summary.status == "completed"
    assert summary.total_evaluations == 4
    assert summary.successful_evaluations == 4
    assert summary.failed_evaluations == 0
    assert summary.total_attempts >= 4
    assert summary.completed_at is not None
    assert summary.average_quality_score is not None
    assert summary.average_quality_score > 0.0

    # Verify persistence in DB
    db_session.expire_all()
    updated_bench = BenchmarkService.get_benchmark_or_404(db_session, bench.id)
    assert updated_bench.status == "completed"
    assert updated_bench.completed_at is not None

    evals = EvaluationService.get_evaluations_for_benchmark(db_session, bench.id)
    assert len(evals) == 4
    for ev in evals:
        assert ev.status == "completed"
        assert ev.response_text is not None
        assert ev.quality_score is not None
        assert ev.judge_reasoning is not None
        assert ev.attempt_count >= 1

        ev_detail = EvaluationService.get_evaluation_with_attempts(db_session, ev.id)
        assert len(ev_detail.attempts) >= 1
        assert ev_detail.attempts[0].attempt_number == 1


@pytest.mark.asyncio
async def test_run_benchmark_already_completed_rejected(db_session):
    """Verify single-run policy rejects second execution on completed benchmark."""
    bench = _setup_benchmark_env(db_session)
    bench.status = "completed"
    db_session.commit()

    with pytest.raises(ValidationException, match="already completed"):
        await BenchmarkService.run_benchmark(bench.id, mock=True, db=db_session)


@pytest.mark.asyncio
async def test_run_benchmark_already_running_rejected(db_session):
    """Verify concurrent execution rejection when benchmark is running."""
    bench = _setup_benchmark_env(db_session)
    bench.status = "running"
    db_session.commit()

    with pytest.raises(ValidationException, match="already currently executing"):
        await BenchmarkService.run_benchmark(bench.id, mock=True, db=db_session)


@pytest.mark.asyncio
async def test_run_benchmark_empty_test_cases_rejected(db_session):
    """Verify execution rejection if project has no test cases."""
    bench = _setup_benchmark_env(db_session, num_test_cases=0)

    with pytest.raises(ValidationException, match="has no test cases"):
        await BenchmarkService.run_benchmark(bench.id, mock=True, db=db_session)


def test_recover_abandoned_running_benchmark_with_evaluations(db_session):
    """Verify recovering an abandoned running benchmark completes it if evaluations succeeded."""
    bench = _setup_benchmark_env(db_session)
    bench.status = "running"
    db_session.commit()

    # Add 1 completed evaluation
    from app.schemas.evaluation import EvaluationCreate
    EvaluationService.record_evaluation(
        db_session,
        EvaluationCreate(
            benchmark_id=bench.id,
            model_name="gemini-3.1-flash-lite",
            provider_name="gemini",
            status="completed",
        ),
    )

    recovered = BenchmarkService.recover_benchmark(db_session, bench.id)
    assert recovered.status == "completed"
    assert recovered.completed_at is not None
    assert "Recovered" in (recovered.description or "")


def test_recover_abandoned_running_benchmark_without_evaluations(db_session):
    """Verify recovering an abandoned running benchmark with zero evaluations marks it failed."""
    bench = _setup_benchmark_env(db_session)
    bench.status = "running"
    db_session.commit()

    recovered = BenchmarkService.recover_benchmark(db_session, bench.id)
    assert recovered.status == "failed"
    assert recovered.completed_at is not None
    assert "Recovered" in (recovered.description or "")


def test_recover_abandoned_benchmarks_batch(db_session):
    """Verify batch reconciliation of multiple abandoned running benchmarks."""
    b1 = _setup_benchmark_env(db_session)
    b1.status = "running"
    b2 = _setup_benchmark_env(db_session)
    b2.status = "running"
    b3 = _setup_benchmark_env(db_session)
    b3.status = "completed"
    db_session.commit()

    recovered = BenchmarkService.recover_abandoned_benchmarks(db_session)
    assert len(recovered) == 2
    assert {r.id for r in recovered} == {b1.id, b2.id}
