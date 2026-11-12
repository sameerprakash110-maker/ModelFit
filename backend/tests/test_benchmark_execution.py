from unittest.mock import Mock

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
    assert BenchmarkService.resolve_provider_for_model("openai/gpt-oss-120b") == "groq"
    assert BenchmarkService.resolve_provider_for_model("openai/gpt-oss-20b") == "groq"

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

    recovered = BenchmarkService.recover_benchmark(db_session, bench.id, force=True)
    assert recovered.status == "completed"
    assert recovered.completed_at is not None
    assert "Recovered" in (recovered.description or "")


def test_recover_abandoned_running_benchmark_without_evaluations(db_session):
    """Verify recovering an abandoned running benchmark with zero evaluations marks it failed."""
    bench = _setup_benchmark_env(db_session)
    bench.status = "running"
    db_session.commit()

    recovered = BenchmarkService.recover_benchmark(db_session, bench.id, force=True)
    assert recovered.status == "failed"
    assert recovered.completed_at is not None
    assert "Recovered" in (recovered.description or "")


def test_recover_abandoned_benchmarks_batch(db_session):
    """Verify batch reconciliation of multiple abandoned running benchmarks exceeding lease window."""
    from datetime import timedelta
    from app.utils.helpers import utc_now

    stale_time = utc_now() - timedelta(seconds=500)

    b1 = _setup_benchmark_env(db_session)
    b1.status = "running"
    b1.updated_at = stale_time
    b2 = _setup_benchmark_env(db_session)
    b2.status = "running"
    b2.updated_at = stale_time
    b3 = _setup_benchmark_env(db_session)
    b3.status = "completed"
    db_session.commit()

    recovered = BenchmarkService.recover_abandoned_benchmarks(db_session, lease_timeout_seconds=300)
    assert len(recovered) == 2
    assert {r.id for r in recovered} == {b1.id, b2.id}


def test_active_benchmark_protection_against_premature_recovery(db_session):
    """Verify active benchmarks within lease window are protected from premature recovery."""
    from app.utils.helpers import utc_now

    bench = _setup_benchmark_env(db_session)
    bench.status = "running"
    bench.updated_at = utc_now()  # Active just now
    db_session.commit()

    # Recovery without force must reject recovery
    with pytest.raises(ValidationException, match="within 300s lease"):
        BenchmarkService.recover_benchmark(
            db_session,
            bench.id,
            lease_timeout_seconds=300,
            force=False,
        )

    # Benchmark status must still remain running
    db_session.refresh(bench)
    assert bench.status == "running"

    # Explicit force recovery must succeed
    forced = BenchmarkService.recover_benchmark(
        db_session,
        bench.id,
        lease_timeout_seconds=300,
        force=True,
    )
    assert forced.status == "failed"


def test_abandoned_benchmark_recovery_after_lease_expiration(db_session):
    """Verify stale benchmarks exceeding lease window are safely recovered."""
    from datetime import timedelta
    from app.utils.helpers import utc_now

    bench = _setup_benchmark_env(db_session)
    bench.status = "running"
    bench.updated_at = utc_now() - timedelta(seconds=600)  # Inactive for 10 minutes
    db_session.commit()

    recovered = BenchmarkService.recover_benchmark(
        db_session,
        bench.id,
        lease_timeout_seconds=300,
        force=False,
    )
    assert recovered.status == "failed"
    assert recovered.completed_at is not None


def test_concurrent_recovery_attempts(db_session):
    """Verify atomic state transitions prevent duplicate or corrupted recovery in race conditions."""
    from datetime import timedelta
    from app.utils.helpers import utc_now

    bench = _setup_benchmark_env(db_session)
    bench.status = "running"
    bench.updated_at = utc_now() - timedelta(seconds=400)
    db_session.commit()

    # First recovery transitions status to failed
    r1 = BenchmarkService.recover_benchmark(db_session, bench.id, lease_timeout_seconds=300)
    assert r1.status == "failed"

    # Second recovery attempt on already-recovered benchmark is a safe no-op
    r2 = BenchmarkService.recover_benchmark(db_session, bench.id, lease_timeout_seconds=300)
    assert r2.status == "failed"
    assert r2.id == bench.id


def test_partially_completed_benchmarks_recovery(db_session):
    """Verify benchmarks with mixed evaluations complete with empirical results upon recovery."""
    from app.schemas.evaluation import EvaluationCreate

    bench = _setup_benchmark_env(db_session)
    bench.status = "running"
    db_session.commit()

    # 1 succeeded, 1 failed
    EvaluationService.record_evaluation(
        db_session,
        EvaluationCreate(
            benchmark_id=bench.id,
            model_name="gemini-3.1-flash-lite",
            provider_name="gemini",
            status="completed",
        ),
    )
    EvaluationService.record_evaluation(
        db_session,
        EvaluationCreate(
            benchmark_id=bench.id,
            model_name="qwen/qwen3.8-27b",
            provider_name="groq",
            status="failed",
        ),
    )

    recovered = BenchmarkService.recover_benchmark(db_session, bench.id, force=True)
    assert recovered.status == "completed"
    assert "1/2 evaluations completed" in recovered.description


def test_multiple_worker_startup_scenarios(db_session):
    """Verify that multiple worker startup reconciliation does not interrupt active benchmarks on other nodes."""
    from datetime import timedelta
    from app.utils.helpers import utc_now

    # Node A is actively running a benchmark (active 5s ago)
    b_active = _setup_benchmark_env(db_session)
    b_active.status = "running"
    b_active.updated_at = utc_now() - timedelta(seconds=5)

    # Node B crashed 15 minutes ago, leaving an abandoned benchmark
    b_abandoned = _setup_benchmark_env(db_session)
    b_abandoned.status = "running"
    b_abandoned.updated_at = utc_now() - timedelta(minutes=15)

    db_session.commit()

    # Node C boots up and reconciles abandoned benchmarks
    recovered_list = BenchmarkService.recover_abandoned_benchmarks(
        db_session, lease_timeout_seconds=300
    )

    # Only Node B's abandoned benchmark should be recovered
    assert len(recovered_list) == 1
    assert recovered_list[0].id == b_abandoned.id

    # Node A's active benchmark must remain running
    db_session.refresh(b_active)
    assert b_active.status == "running"


@pytest.mark.asyncio
async def test_run_benchmark_unsupported_model_rejected(db_session):
    """Verify benchmark with unsupported model is rejected early and creates no evaluations."""
    bench = _setup_benchmark_env(db_session, model_list=["gpt-4o"])

    with pytest.raises(ValidationException, match="Unable to resolve provider for model 'gpt-4o'"):
        await BenchmarkService.run_benchmark(
            benchmark_id=bench.id,
            mock=True,
            db=db_session,
        )

    # Status must not be running/completed, and zero evaluations must be created
    db_session.refresh(bench)
    assert bench.status == "pending"
    evals = EvaluationService.get_evaluations_for_benchmark(db_session, bench.id)
    assert len(evals) == 0


@pytest.mark.asyncio
async def test_run_benchmark_groq_openai_prefixed_model_e2e(db_session):
    """Verify Groq models with 'openai/' in identifier resolve to groq and execute successfully."""
    bench = _setup_benchmark_env(
        db_session,
        model_list=["openai/gpt-oss-120b", "gemini-3.1-flash-lite"],
        num_test_cases=2,
        repeats=1,
    )

    summary = await BenchmarkService.run_benchmark(
        benchmark_id=bench.id,
        mock=True,
        judge_enabled=True,
        db=db_session,
    )

    assert summary.status == "completed"
    assert summary.total_evaluations == 4  # 2 models x 2 test cases
    assert summary.successful_evaluations == 4

    evals = EvaluationService.get_evaluations_for_benchmark(db_session, bench.id)
    assert len(evals) == 4
    groq_evals = [e for e in evals if e.model_name == "openai/gpt-oss-120b"]
    assert len(groq_evals) == 2
    assert all(e.provider_name == "groq" for e in groq_evals)


@pytest.mark.asyncio
async def test_run_benchmark_unconfigured_provider_records_failed_evaluation(
    db_session, monkeypatch
):
    """Verify supported provider with missing API key records failed evaluation instead of being dropped."""
    bench = _setup_benchmark_env(
        db_session,
        model_list=["gemini-3.1-flash-lite"],
        num_test_cases=1,
        repeats=1,
    )

    unconfigured_provider = Mock()
    unconfigured_provider.is_configured.return_value = False
    monkeypatch.setattr(
        "app.services.benchmark_service.get_provider",
        lambda provider_name: unconfigured_provider,
    )

    summary = await BenchmarkService.run_benchmark(
        benchmark_id=bench.id,
        mock=False,  # Live mode with unconfigured keys
        judge_enabled=False,
        db=db_session,
    )

    assert summary.status == "failed"
    assert summary.total_evaluations == 1
    assert summary.failed_evaluations == 1

    evals = EvaluationService.get_evaluations_for_benchmark(db_session, bench.id)
    assert len(evals) == 1
    eval_record = evals[0]
    assert eval_record.status == "failed"
    assert len(eval_record.attempts) == 1
    unconfigured_provider.is_configured.assert_called_once_with()
    attempt = eval_record.attempts[0]
    assert attempt.error_type == "unconfigured_provider"
    assert "not configured" in (attempt.error_message or "").lower()
