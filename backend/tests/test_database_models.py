from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError

from app.models.benchmark import Benchmark
from app.models.evaluation import Evaluation
from app.models.evaluation_attempt import EvaluationAttempt
from app.models.project import Project
from app.models.test_case import TestCase
from app.models.user import User


def _new_user(email: str = "persisted@example.com", **kwargs) -> User:
    return User(
        email=email,
        hashed_password="$argon2id$test-hash-never-plaintext",
        **kwargs,
    )


def test_user_persists_hash_and_active_status(db_session):
    user = _new_user(is_active=False)
    db_session.add(user)
    db_session.commit()
    user_id = user.id

    db_session.expire_all()
    saved = db_session.get(User, user_id)
    assert saved is not None
    assert saved.email == "persisted@example.com"
    assert saved.hashed_password == "$argon2id$test-hash-never-plaintext"
    assert saved.hashed_password != "plaintext-password"
    assert saved.is_active is False
    assert saved.created_at is not None
    assert saved.updated_at is not None


def test_user_email_is_unique(db_session):
    db_session.add_all([_new_user(), _new_user(email="persisted@example.com")])
    try:
        db_session.commit()
    except IntegrityError:
        db_session.rollback()
    else:
        raise AssertionError("duplicate user email was accepted")


def test_user_project_relationship_and_owner_persistence(db_session):
    user = _new_user()
    project = Project(name="Owned", system_prompt="Be helpful", owner=user)
    db_session.add(user)
    db_session.commit()
    user_id, project_id = user.id, project.id

    db_session.expire_all()
    saved_user = db_session.get(User, user_id)
    saved_project = db_session.get(Project, project_id)
    assert saved_project.owner_id == user_id
    assert saved_project.owner.id == user_id
    assert [p.id for p in saved_user.projects] == [project_id]


def test_project_owner_foreign_key_rejects_unknown_user(db_session):
    db_session.add(
        Project(
            name="Invalid owner",
            system_prompt="Be helpful",
            owner_id="00000000-0000-0000-0000-000000000001",
        )
    )
    try:
        db_session.commit()
    except IntegrityError:
        db_session.rollback()
    else:
        raise AssertionError("unknown project owner passed the foreign key")


def test_database_user_delete_cascades_to_project_tree(db_session):
    user = _new_user()
    project = Project(name="Owned", system_prompt="Be helpful", owner=user)
    benchmark = Benchmark(project=project, name="Benchmark", selected_models=[])
    case = TestCase(
        project=project,
        input_prompt="Prompt",
        expected_behavior="Expected",
    )
    db_session.add_all([user, benchmark, case])
    db_session.commit()
    user_id, project_id, benchmark_id, case_id = user.id, project.id, benchmark.id, case.id

    # Core DELETE bypasses ORM cascades and verifies the database FK actions.
    db_session.execute(delete(User).where(User.id == user_id))
    db_session.commit()
    db_session.expire_all()
    assert db_session.get(User, user_id) is None
    assert db_session.get(Project, project_id) is None
    assert db_session.get(Benchmark, benchmark_id) is None
    assert db_session.get(TestCase, case_id) is None


def test_evaluation_attempt_mock_flag_defaults_persists_and_filters(db_session):
    project = Project(name="Mock flags", system_prompt="Be helpful")
    benchmark = Benchmark(project=project, name="Benchmark", selected_models=[])
    evaluation = Evaluation(
        benchmark=benchmark,
        model_name="gemini-3.1-flash-lite",
        provider_name="gemini",
    )
    live = EvaluationAttempt(evaluation=evaluation, attempt_number=1)
    mocked = EvaluationAttempt(evaluation=evaluation, attempt_number=2, is_mock=True)
    db_session.add_all([live, mocked])
    db_session.commit()
    live_id, mocked_id = live.id, mocked.id

    db_session.expire_all()
    saved_live = db_session.get(EvaluationAttempt, live_id)
    saved_mock = db_session.get(EvaluationAttempt, mocked_id)
    assert saved_live.is_mock is False
    assert saved_mock.is_mock is True
    assert db_session.scalars(
        select(EvaluationAttempt).where(EvaluationAttempt.is_mock.is_(True))
    ).all() == [saved_mock]
    assert EvaluationAttempt.__table__.c.is_mock.index is True
