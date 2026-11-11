from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

from app.core.config import get_settings


BACKEND_DIR = Path(__file__).resolve().parents[1]
ALEMBIC_CONFIG = BACKEND_DIR / "alembic.ini"


def _run_migration(monkeypatch, database_url: str, revision: str, operation: str) -> None:
    monkeypatch.setenv("DATABASE_URL", database_url)
    get_settings.cache_clear()
    try:
        cfg = Config(str(ALEMBIC_CONFIG))
        getattr(command, operation)(cfg, revision)
    finally:
        get_settings.cache_clear()


def _database_url(tmp_path, name: str = "migration.db") -> str:
    return f"sqlite:///{(tmp_path / name).as_posix()}"


def test_fresh_upgrade_downgrade_and_reupgrade_head(tmp_path, monkeypatch):
    url = _database_url(tmp_path)
    _run_migration(monkeypatch, url, "head", "upgrade")
    engine = create_engine(url)
    try:
        inspector = inspect(engine)
        assert inspector.get_table_names()
        assert {c["name"] for c in inspector.get_columns("users")} >= {
            "id", "email", "hashed_password", "is_active", "created_at", "updated_at"
        }
        assert any(
            ix["name"] == "ix_users_email" and ix["unique"]
            for ix in inspector.get_indexes("users")
        )
        assert any(
            fk["referred_table"] == "users"
            and fk["options"].get("ondelete") == "CASCADE"
            for fk in inspector.get_foreign_keys("projects")
        )
        assert inspector.get_columns("projects")[
            next(i for i, col in enumerate(inspector.get_columns("projects")) if col["name"] == "owner_id")
        ]["nullable"]
        attempt_mock = next(
            col for col in inspector.get_columns("evaluation_attempts") if col["name"] == "is_mock"
        )
        assert attempt_mock["nullable"] is False
        assert any(ix["name"] == "ix_evaluation_attempts_is_mock" for ix in inspector.get_indexes("evaluation_attempts"))
        with engine.connect() as conn:
            assert conn.execute(text("select version_num from alembic_version")).scalar_one() == "c1e73a95f042"

        _run_migration(monkeypatch, url, "b6d9e3107ca4", "downgrade")
        inspector = inspect(engine)
        assert "is_mock" not in {c["name"] for c in inspector.get_columns("evaluation_attempts")}
        assert "owner_id" in {c["name"] for c in inspector.get_columns("projects")}

        _run_migration(monkeypatch, url, "head", "upgrade")
        inspector = inspect(engine)
        assert "is_mock" in {c["name"] for c in inspector.get_columns("evaluation_attempts")}
        with engine.connect() as conn:
            assert conn.execute(text("select version_num from alembic_version")).scalar_one() == "c1e73a95f042"
    finally:
        engine.dispose()


def test_existing_project_is_left_unowned_and_nullable_owner_fk_is_added(tmp_path, monkeypatch):
    url = _database_url(tmp_path, "legacy-project.db")
    _run_migration(monkeypatch, url, "d94c56b1a8e2", "upgrade")
    engine = create_engine(url)
    try:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "INSERT INTO projects (id, name, system_prompt, created_at, updated_at) "
                    "VALUES (:id, :name, :prompt, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
                ),
                {"id": "legacy-project-id", "name": "Legacy", "prompt": ""},
            )

        _run_migration(monkeypatch, url, "head", "upgrade")
        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT id, owner_id FROM projects WHERE id = 'legacy-project-id'")
            ).one()
        assert row.id == "legacy-project-id"
        assert row.owner_id is None
        owner_col = next(col for col in inspect(engine).get_columns("projects") if col["name"] == "owner_id")
        assert owner_col["nullable"] is True
    finally:
        engine.dispose()


def test_contract_migration_downgrade_reverses_expected_behavior_nullability(tmp_path, monkeypatch):
    url = _database_url(tmp_path, "contract-downgrade.db")
    _run_migration(monkeypatch, url, "head", "upgrade")
    engine = create_engine(url)
    try:
        _run_migration(monkeypatch, url, "02505316186f", "downgrade")
        inspector = inspect(engine)
        expected = next(col for col in inspector.get_columns("test_cases") if col["name"] == "expected_behavior")
        criteria = next(col for col in inspector.get_columns("test_cases") if col["name"] == "evaluation_criteria")
        assert expected["nullable"] is True
        assert "TEXT" in str(criteria["type"]).upper()

        _run_migration(monkeypatch, url, "head", "upgrade")
        inspector = inspect(engine)
        expected = next(col for col in inspector.get_columns("test_cases") if col["name"] == "expected_behavior")
        assert expected["nullable"] is False
    finally:
        engine.dispose()
