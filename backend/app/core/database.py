from typing import Generator
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

# Engine configuration with SQLite thread handling if applicable
engine_kwargs = {"echo": False}
if settings.DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(settings.DATABASE_URL, **engine_kwargs)


# ---------------------------------------------------------------------------
# SQLite performance & integrity pragmas
# Guarded so they only execute for SQLite URLs; PostgreSQL and other dialects
# ignore this listener entirely.
# ---------------------------------------------------------------------------
if settings.DATABASE_URL.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_connection, connection_record):  # noqa: ANN001
        """Configure SQLite connection with FK enforcement, WAL mode, and busy timeout."""
        cursor = dbapi_connection.cursor()
        # Enforce foreign-key constraints (SQLite disables them by default)
        cursor.execute("PRAGMA foreign_keys = ON")
        # Write-Ahead Logging: improves concurrent read/write performance
        cursor.execute("PRAGMA journal_mode = WAL")
        # Wait up to 5 s instead of immediately failing on a locked database
        cursor.execute("PRAGMA busy_timeout = 5000")
        cursor.close()


SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Declarative base class for all SQLAlchemy ORM models."""
    pass


def get_db() -> Generator[Session, None, None]:
    """Dependency injection helper for database sessions in FastAPI routes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Initialize all tables defined on Base metadata.

    Useful for development and testing. Production deployments should use Alembic.
    """
    Base.metadata.create_all(bind=engine)
