from decimal import Decimal
import pytest
from sqlalchemy import select
from app.core.exceptions import EntityNotFoundException
from app.models.benchmark import Benchmark
from app.models.evaluation import Evaluation
from app.models.evaluation_attempt import EvaluationAttempt
from app.models.project import Project
from app.models.test_case import TestCase
from app.schemas.evaluation import (
    EvaluationAttemptCreate,
    EvaluationCreate,
    EvaluationResponse,
)
from app.services.evaluation_service import EvaluationService


def _create_fixture_project(db) -> Project:
    p = Project(
        name="Eval Project",
        system_prompt="You are a helpful assistant.",
    )
    db.add(p)
    db.commit()
    return p


def _create_fixture_benchmark(db, project_id: str) -> Benchmark:
    b = Benchmark(
        project_id=project_id,
        name="Eval Benchmark",
        selected_models=["gemini-3.1-flash-lite"],
    )
    db.add(b)
    db.commit()
    return b


def _create_fixture_test_case(db, project_id: str) -> TestCase:
    tc = TestCase(
        project_id=project_id,
        input_prompt="Compute 10 + 20",
        expected_behavior="Return 30",
    )
    db.add(tc)
    db.commit()
    return tc


def test_record_evaluation_with_contract_fields(db_session):
    """Verify evaluation record persistence adhering to the current DB contract."""
    proj = _create_fixture_project(db_session)
    bench = _create_fixture_benchmark(db_session, proj.id)
    tc = _create_fixture_test_case(db_session, proj.id)

    eval_in = EvaluationCreate(
        benchmark_id=bench.id,
        test_case_id=tc.id,
        model_name="gemini-3.1-flash-lite",
        provider_name="gemini",
        input_tokens=150,
        output_tokens=75,
        execution_cost=Decimal("0.00035000"),
        latency_ms=210.5,
        quality_score=9.2,
        response_text="The answer is 30.",
        status="completed",
        attempt_count=1,
        repeat_index=0,
        prompt_version="original",
        judge_reasoning="Accurate and direct.",
    )

    ev = EvaluationService.record_evaluation(db_session, eval_in)
    assert ev.id is not None
    assert ev.benchmark_id == bench.id
    assert ev.test_case_id == tc.id
    assert ev.input_tokens == 150
    assert ev.output_tokens == 75
    assert ev.execution_cost == Decimal("0.00035000")
    assert ev.latency_ms == 210.5
    assert ev.quality_score == 9.2
    assert ev.attempt_count == 1
    assert ev.repeat_index == 0
    assert ev.prompt_version == "original"
    assert ev.judge_reasoning == "Accurate and direct."


def test_record_evaluation_with_attempts_aggregates_metrics(db_session):
    """Verify that multiple attempt metrics aggregate into the parent evaluation."""
    proj = _create_fixture_project(db_session)
    bench = _create_fixture_benchmark(db_session, proj.id)
    tc = _create_fixture_test_case(db_session, proj.id)

    attempts = [
        EvaluationAttemptCreate(
            attempt_number=1,
            input_tokens=100,
            output_tokens=0,
            latency_ms=500.0,
            execution_cost=Decimal("0.00010000"),
            error_type="timeout",
            error_message="Gateway timeout",
        ),
        EvaluationAttemptCreate(
            attempt_number=2,
            input_tokens=100,
            output_tokens=50,
            latency_ms=250.0,
            execution_cost=Decimal("0.00020000"),
            error_type=None,
            error_message=None,
        ),
    ]

    eval_in = EvaluationCreate(
        benchmark_id=bench.id,
        test_case_id=tc.id,
        model_name="gpt-4o",
        provider_name="openai",
        response_text="Success on retry",
        status="completed",
        quality_score=8.5,
    )

    ev = EvaluationService.record_evaluation(db_session, eval_in, attempts=attempts)
    assert ev.id is not None
    assert ev.attempt_count == 2
    assert ev.input_tokens == 200  # 100 + 100
    assert ev.output_tokens == 50   # 0 + 50
    assert ev.execution_cost == Decimal("0.00030000")  # 0.0001 + 0.0002
    assert ev.latency_ms == 750.0  # 500 + 250

    # Query with attempts
    ev_with_att = EvaluationService.get_evaluation_with_attempts(db_session, ev.id)
    assert ev_with_att is not None
    assert len(ev_with_att.attempts) == 2
    assert ev_with_att.attempts[0].attempt_number == 1
    assert ev_with_att.attempts[0].error_type == "timeout"
    assert ev_with_att.attempts[1].attempt_number == 2
    assert ev_with_att.attempts[1].error_type is None


def test_legacy_field_mapping_in_evaluation_create():
    """Verify that EvaluationCreate maps old field names (prompt_tokens, total_cost, judge_score) to current columns."""
    eval_in = EvaluationCreate(
        benchmark_id="bench-123",
        model_name="gpt-4o",
        provider_name="openai",
        prompt_tokens=120,
        completion_tokens=60,
        total_cost=0.00045,
        judge_score=7.8,
    )

    assert eval_in.input_tokens == 120
    assert eval_in.output_tokens == 60
    assert eval_in.execution_cost == Decimal("0.00045")
    assert eval_in.quality_score == 7.8


def test_legacy_field_accessors_in_evaluation_response():
    """Verify EvaluationResponse exposes computed fields matching legacy names."""
    resp = EvaluationResponse(
        id="eval-123",
        benchmark_id="bench-123",
        model_name="gemini-3.1-flash-lite",
        provider_name="gemini",
        input_tokens=300,
        output_tokens=150,
        execution_cost=Decimal("0.00075"),
        latency_ms=180.0,
        quality_score=8.9,
        created_at="2026-11-10T00:00:00Z",
        updated_at="2026-11-10T00:00:00Z",
    )

    assert resp.prompt_tokens == 300
    assert resp.completion_tokens == 150
    assert resp.total_cost == 0.00075
    assert resp.judge_score == 8.9


def test_record_evaluation_nonexistent_benchmark_raises_not_found(db_session):
    """Recording an evaluation for a nonexistent benchmark should raise EntityNotFoundException."""
    eval_in = EvaluationCreate(
        benchmark_id="nonexistent-benchmark-id",
        model_name="gpt-4o",
        provider_name="openai",
    )

    with pytest.raises(EntityNotFoundException):
        EvaluationService.record_evaluation(db_session, eval_in)


def test_get_evaluations_for_benchmark_filtered(db_session):
    """Verify querying evaluations by benchmark with test_case_id and model_name filters."""
    proj = _create_fixture_project(db_session)
    bench = _create_fixture_benchmark(db_session, proj.id)
    tc1 = _create_fixture_test_case(db_session, proj.id)
    tc2 = _create_fixture_test_case(db_session, proj.id)

    # Add 3 evaluations
    for tc, model in [(tc1, "gemini-3.1-flash-lite"), (tc1, "gpt-4o"), (tc2, "gpt-4o")]:
        EvaluationService.record_evaluation(
            db_session,
            EvaluationCreate(
                benchmark_id=bench.id,
                test_case_id=tc.id,
                model_name=model,
                provider_name="gemini" if "gemini" in model else "openai",
            ),
        )

    all_evals = EvaluationService.get_evaluations_for_benchmark(db_session, bench.id)
    assert len(all_evals) == 3

    tc1_evals = EvaluationService.get_evaluations_for_benchmark(db_session, bench.id, test_case_id=tc1.id)
    assert len(tc1_evals) == 2

    gpt4o_evals = EvaluationService.get_evaluations_for_benchmark(db_session, bench.id, model_name="gpt-4o")
    assert len(gpt4o_evals) == 2
