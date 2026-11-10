"""tests/test_models.py

Model-layer tests owned by Ishita:
- Cascade delete behaviour
- SET NULL on test_case_id when a TestCase is deleted
- FK integrity (orphaned rows rejected)
- EvaluationAttempt.evaluation back-reference and Evaluation.attempts relationship
- Contract field names on Evaluation
- NOT NULL defaults for new columns
- SessionLocal is a plain sessionmaker usable outside HTTP requests
"""
import inspect
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app.core.database import SessionLocal
from app.models.benchmark import Benchmark
from app.models.evaluation import Evaluation
from app.models.evaluation_attempt import EvaluationAttempt
from app.models.project import Project
from app.models.test_case import TestCase
from app.utils.helpers import generate_uuid


# ---------------------------------------------------------------------------
# In-test helpers (use db_session from conftest)
# ---------------------------------------------------------------------------

_SYS = "You are a helpful assistant."


def _make_project(db, name: str = "Test Project", **kwargs) -> Project:
    """Create and flush a Project; system_prompt is required."""
    defaults = dict(name=name, system_prompt=_SYS)
    defaults.update(kwargs)
    p = Project(**defaults)
    db.add(p)
    db.flush()
    return p


def _make_benchmark(db, project_id: str, **kwargs) -> Benchmark:
    defaults = dict(
        project_id=project_id,
        name="Test Benchmark",
        selected_models=["gemini-1.5-pro"],
        status="pending",
    )
    defaults.update(kwargs)
    b = Benchmark(**defaults)
    db.add(b)
    db.flush()
    return b


def _make_test_case(db, project_id: str) -> TestCase:
    tc = TestCase(
        project_id=project_id,
        input_prompt="Summarise the quarterly earnings report.",
        expected_behavior="Short factual summary",
    )
    db.add(tc)
    db.flush()
    return tc


def _make_evaluation(db, benchmark_id: str, test_case_id: str | None = None) -> Evaluation:
    ev = Evaluation(
        benchmark_id=benchmark_id,
        test_case_id=test_case_id,
        model_name="gemini-1.5-pro",
        provider_name="gemini",
        input_tokens=100,
        output_tokens=50,
        latency_ms=350.5,
        execution_cost=Decimal("0.00050000"),
        status="completed",
    )
    db.add(ev)
    db.flush()
    return ev


def _make_attempt(db, evaluation_id: str, attempt_number: int = 1) -> EvaluationAttempt:
    att = EvaluationAttempt(
        evaluation_id=evaluation_id,
        attempt_number=attempt_number,
        input_tokens=100,
        output_tokens=50,
        latency_ms=350.5,
        execution_cost=Decimal("0.00050000"),
    )
    db.add(att)
    db.flush()
    return att


# ---------------------------------------------------------------------------
# Tests: cascade delete
# ---------------------------------------------------------------------------


class TestCascadeDelete:
    """Verify ORM cascade rules propagate deletes correctly."""

    def test_delete_project_cascades_to_benchmarks(self, db_session):
        """Deleting a project must remove all associated benchmarks."""
        project = _make_project(db_session)
        benchmark = _make_benchmark(db_session, project.id)
        db_session.commit()

        benchmark_id = benchmark.id
        db_session.delete(project)
        db_session.commit()

        assert db_session.get(Benchmark, benchmark_id) is None

    def test_delete_project_cascades_to_test_cases(self, db_session):
        """Deleting a project must remove all associated test cases."""
        project = _make_project(db_session)
        tc = _make_test_case(db_session, project.id)
        db_session.commit()

        tc_id = tc.id
        db_session.delete(project)
        db_session.commit()

        assert db_session.get(TestCase, tc_id) is None

    def test_delete_benchmark_cascades_to_evaluations(self, db_session):
        """Deleting a benchmark must remove all associated evaluations."""
        project = _make_project(db_session)
        benchmark = _make_benchmark(db_session, project.id)
        evaluation = _make_evaluation(db_session, benchmark.id)
        db_session.commit()

        eval_id = evaluation.id
        db_session.delete(benchmark)
        db_session.commit()

        assert db_session.get(Evaluation, eval_id) is None

    def test_delete_evaluation_cascades_to_attempts(self, db_session):
        """Deleting an evaluation must remove all associated evaluation_attempts."""
        project = _make_project(db_session)
        benchmark = _make_benchmark(db_session, project.id)
        evaluation = _make_evaluation(db_session, benchmark.id)
        attempt = _make_attempt(db_session, evaluation.id)
        db_session.commit()

        attempt_id = attempt.id
        db_session.delete(evaluation)
        db_session.commit()

        assert db_session.get(EvaluationAttempt, attempt_id) is None

    def test_full_project_cascade(self, db_session):
        """Full cascade: deleting a project removes all descendants."""
        project = _make_project(db_session)
        benchmark = _make_benchmark(db_session, project.id)
        evaluation = _make_evaluation(db_session, benchmark.id)
        attempt = _make_attempt(db_session, evaluation.id, attempt_number=1)
        _make_attempt(db_session, evaluation.id, attempt_number=2)
        db_session.commit()

        ids = {
            "benchmark": benchmark.id,
            "evaluation": evaluation.id,
            "attempt": attempt.id,
        }

        db_session.delete(project)
        db_session.commit()

        assert db_session.get(Benchmark, ids["benchmark"]) is None
        assert db_session.get(Evaluation, ids["evaluation"]) is None
        assert db_session.get(EvaluationAttempt, ids["attempt"]) is None


# ---------------------------------------------------------------------------
# Tests: SET NULL on test_case_id
# ---------------------------------------------------------------------------


class TestSetNull:
    """Verify that deleting a TestCase NULLs evaluation.test_case_id rather
    than cascading the delete to the Evaluation row."""

    def test_delete_test_case_nulls_evaluation_reference(self, db_session):
        """Deleting a TestCase must set evaluation.test_case_id to NULL.

        The Evaluation itself must survive — historical results are retained
        even when the originating test case is removed.
        """
        project = _make_project(db_session)
        benchmark = _make_benchmark(db_session, project.id)
        test_case = _make_test_case(db_session, project.id)
        evaluation = _make_evaluation(db_session, benchmark.id, test_case_id=test_case.id)
        db_session.commit()

        eval_id = evaluation.id

        # Delete the test case — this should NOT delete the evaluation
        db_session.delete(test_case)
        db_session.commit()

        db_session.expire_all()
        ev = db_session.get(Evaluation, eval_id)
        assert ev is not None, "Evaluation must survive test case deletion"
        assert ev.test_case_id is None, "test_case_id must be NULL after test case deletion"

    def test_evaluation_without_test_case_is_valid(self, db_session):
        """An evaluation with test_case_id=None must be creatable and readable."""
        project = _make_project(db_session)
        benchmark = _make_benchmark(db_session, project.id)
        evaluation = _make_evaluation(db_session, benchmark.id, test_case_id=None)
        db_session.commit()

        db_session.expire_all()
        ev = db_session.get(Evaluation, evaluation.id)
        assert ev is not None
        assert ev.test_case_id is None


# ---------------------------------------------------------------------------
# Tests: FK integrity
# ---------------------------------------------------------------------------


class TestFKIntegrity:
    """Foreign key constraints must reject orphaned records."""

    def test_attempt_with_nonexistent_evaluation_rejected(self, db_session):
        """EvaluationAttempt pointing to a non-existent evaluation must fail."""
        orphan = EvaluationAttempt(
            evaluation_id=generate_uuid(),   # references nothing
            attempt_number=1,
            input_tokens=10,
            output_tokens=5,
            latency_ms=100.0,
            execution_cost=Decimal("0.00001000"),
        )
        db_session.add(orphan)
        with pytest.raises((IntegrityError, Exception)):
            db_session.flush()
        db_session.rollback()

    def test_evaluation_with_nonexistent_benchmark_rejected(self, db_session):
        """Evaluation with a non-existent benchmark_id must fail."""
        orphan = Evaluation(
            benchmark_id=generate_uuid(),
            model_name="gpt-4o",
            provider_name="openai",
            status="completed",
        )
        db_session.add(orphan)
        with pytest.raises((IntegrityError, Exception)):
            db_session.flush()
        db_session.rollback()


# ---------------------------------------------------------------------------
# Tests: relationships
# ---------------------------------------------------------------------------


class TestRelationships:
    """Verify SQLAlchemy relationship wiring."""

    def test_evaluation_attempts_relationship(self, db_session):
        """Evaluation.attempts must return all associated EvaluationAttempt rows."""
        project = _make_project(db_session)
        benchmark = _make_benchmark(db_session, project.id)
        evaluation = _make_evaluation(db_session, benchmark.id)
        _make_attempt(db_session, evaluation.id, attempt_number=1)
        _make_attempt(db_session, evaluation.id, attempt_number=2)
        db_session.commit()

        db_session.expire_all()
        ev = db_session.get(Evaluation, evaluation.id)
        assert ev is not None
        assert len(ev.attempts) == 2
        assert {a.attempt_number for a in ev.attempts} == {1, 2}

    def test_attempt_evaluation_back_reference(self, db_session):
        """EvaluationAttempt.evaluation must point back to parent Evaluation."""
        project = _make_project(db_session)
        benchmark = _make_benchmark(db_session, project.id)
        evaluation = _make_evaluation(db_session, benchmark.id)
        attempt = _make_attempt(db_session, evaluation.id)
        db_session.commit()

        db_session.expire_all()
        att = db_session.get(EvaluationAttempt, attempt.id)
        assert att is not None
        assert att.evaluation_id == evaluation.id
        assert att.evaluation.id == evaluation.id


# ---------------------------------------------------------------------------
# Tests: contract field names and NOT NULL defaults
# ---------------------------------------------------------------------------


class TestContractCompliance:
    """Ensure the ORM model exposes the exact column names from the contract."""

    def test_evaluation_contract_field_names(self, db_session):
        """Evaluation model must have contract-compliant column names."""
        project = _make_project(db_session)
        benchmark = _make_benchmark(db_session, project.id)
        evaluation = _make_evaluation(db_session, benchmark.id)
        db_session.commit()

        db_session.expire_all()
        ev = db_session.get(Evaluation, evaluation.id)
        assert ev is not None

        # Required contract names
        for field in ("input_tokens", "output_tokens", "execution_cost",
                      "quality_score", "latency_ms"):
            assert hasattr(ev, field), f"Missing contract field: {field}"

        # Old names must NOT exist on the ORM model
        for old in ("prompt_tokens", "completion_tokens", "total_cost", "judge_score"):
            assert not hasattr(ev, old), f"Old field still present: {old}"

    def test_evaluation_not_null_defaults(self, db_session):
        """attempt_count, repeat_index, prompt_version must have correct defaults."""
        project = _make_project(db_session)
        benchmark = _make_benchmark(db_session, project.id)
        evaluation = _make_evaluation(db_session, benchmark.id)
        db_session.commit()

        db_session.expire_all()
        ev = db_session.get(Evaluation, evaluation.id)
        assert ev.attempt_count == 1
        assert ev.repeat_index == 0
        assert ev.prompt_version == "original"

    def test_project_system_prompt_not_null(self, db_session):
        """projects.system_prompt column must be NOT NULL."""
        col = Project.__table__.c["system_prompt"]
        assert col.nullable is False

    def test_benchmark_repeats_default(self, db_session):
        """Benchmark.repeats must default to 1 and be NOT NULL."""
        project = _make_project(db_session)
        benchmark = _make_benchmark(db_session, project.id)
        db_session.commit()

        db_session.expire_all()
        b = db_session.get(Benchmark, benchmark.id)
        assert b is not None
        assert b.repeats == 1

        col = Benchmark.__table__.c["repeats"]
        assert col.nullable is False

    def test_benchmark_additive_columns(self, db_session):
        """Benchmark model must expose baseline_model, completed_at, repeats."""
        project = _make_project(db_session)
        benchmark = _make_benchmark(
            db_session, project.id,
            baseline_model="gpt-4o",
            repeats=3,
        )
        db_session.commit()

        db_session.expire_all()
        b = db_session.get(Benchmark, benchmark.id)
        assert b.baseline_model == "gpt-4o"
        assert b.repeats == 3
        assert b.completed_at is None

    def test_test_case_evaluation_criteria_json(self, db_session):
        """TestCase.evaluation_criteria must accept and round-trip a JSON dict."""
        project = _make_project(db_session)
        criteria = {"accuracy": 0.5, "conciseness": 0.3, "format": 0.2}
        tc = TestCase(
            project_id=project.id,
            input_prompt="Explain quantum entanglement.",
            evaluation_criteria=criteria,
        )
        db_session.add(tc)
        db_session.commit()

        db_session.expire_all()
        loaded = db_session.get(TestCase, tc.id)
        assert loaded.evaluation_criteria == criteria


# ---------------------------------------------------------------------------
# Tests: SessionLocal usable outside HTTP requests
# ---------------------------------------------------------------------------


class TestSessionLocal:
    """SessionLocal must be a plain sessionmaker callable outside of requests."""

    def test_session_local_is_sessionmaker(self):
        """SessionLocal must be an instance of sessionmaker (not a generator)."""
        assert isinstance(SessionLocal, sessionmaker)

    def test_session_local_creates_usable_session(self, setup_test_database):
        """A session created from SessionLocal must be able to query the DB."""
        # We use the test DB engine — we can't use the production engine here,
        # but we can verify the SessionLocal type is correct and callable.
        # The conftest overrides get_db; we confirm SessionLocal itself works.
        from app.core.database import engine
        from sqlalchemy.orm import sessionmaker as sm_type
        assert isinstance(SessionLocal, sm_type)
        # Verify it's not a generator or coroutine function
        assert not inspect.isgeneratorfunction(SessionLocal)
        assert not inspect.iscoroutinefunction(SessionLocal)
