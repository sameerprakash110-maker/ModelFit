import os
import sys
from typing import Generator
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

# Ensure backend root is on sys.path regardless of execution context
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Tests never call real providers. Blank every provider key before the app reads
# settings; environment variables override backend/.env, so real keys there are ignored.
for _key in ("GEMINI_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY"):
    os.environ[_key] = ""

from app.core.database import Base, get_db
from app.models.test_case import TestCase
from app.main import app

# Prevent pytest from attempting to collect the TestCase SQLAlchemy model as a test suite
TestCase.__test__ = False

# Isolated in-memory SQLite database for testing to ensure dev database is never modified
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@event.listens_for(test_engine, "connect")
def _enable_sqlite_foreign_keys(dbapi_connection, connection_record):  # noqa: ANN001
    """Match production SQLite FK enforcement in the isolated test database."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys = ON")
    cursor.close()

TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=test_engine,
    expire_on_commit=False,
)


@pytest.fixture(autouse=True)
def setup_test_database():
    """Create all tables before each test and drop them after."""
    from app.services.auth_service import AuthService
    from app.services.ownership_service import OwnershipService

    # Point account storage at the isolated test database, never the dev DB file
    AuthService._session_factory = TestingSessionLocal
    Base.metadata.create_all(bind=test_engine)
    AuthService.reset_store()
    OwnershipService.reset_store()
    yield
    Base.metadata.drop_all(bind=test_engine)
    AuthService.reset_store()
    OwnershipService.reset_store()


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    """Provide an isolated database session per test."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def test_user():
    from app.services.auth_service import AuthService
    from app.schemas.auth import UserCreate

    return AuthService.create_user(
        UserCreate(
            email="test_engineer@modelfit.com",
            password="SecurePassword123!",
            full_name="ModelFit Test User",
        )
    )


@pytest.fixture
def auth_token(test_user) -> str:
    from app.core.security import create_access_token

    return create_access_token(subject=test_user.id)


@pytest.fixture
def client(db_session: Session, auth_token: str) -> Generator[TestClient, None, None]:
    """TestClient fixture with get_db dependency overridden and default authenticated session."""

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        test_client.headers["Authorization"] = f"Bearer {auth_token}"
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def unauthenticated_client(db_session: Session) -> Generator[TestClient, None, None]:
    """TestClient fixture without default authentication headers for security testing."""

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
