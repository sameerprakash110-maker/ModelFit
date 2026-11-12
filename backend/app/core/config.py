import os
from functools import lru_cache
from typing import Any, List, Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables and .env file."""

    APP_NAME: str = "ModelFit"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # Database
    DATABASE_URL: str = "sqlite:///./modelfit.db"

    # CORS
    FRONTEND_URL: str = "http://localhost:5173"
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    # AI Provider API Keys
    GEMINI_API_KEY: str | None = None
    GROQ_API_KEY: str | None = None
    OPENROUTER_API_KEY: str | None = None

    # JWT & Authentication
    JWT_SECRET_KEY: str = Field(
        default="modelfit-insecure-dev-secret-key-change-in-production-min32chars",
        description="Signing secret key for JWT access tokens",
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Benchmark Operational Limits
    BENCHMARK_MAX_MODELS: int = 10
    BENCHMARK_MAX_TEST_CASES: int = 100
    BENCHMARK_MAX_REPEATS: int = 10
    BENCHMARK_MAX_TOTAL_INVOCATIONS: int = 500
    BENCHMARK_DEFAULT_CONCURRENCY: int = 5
    BENCHMARK_MAX_CONCURRENCY: int = 20
    BENCHMARK_TIMEOUT_SECONDS: int = 120

    def validate_production_security(self) -> None:
        """Fail safely if running in production without secure JWT configuration."""
        if not self.DEBUG:
            insecure_defaults = [
                "modelfit-insecure-dev-secret-key-change-in-production-min32chars",
                "secret",
                "changeme",
                "",
            ]
            if not self.JWT_SECRET_KEY or self.JWT_SECRET_KEY in insecure_defaults or len(self.JWT_SECRET_KEY) < 32:
                raise ValueError(
                    "CRITICAL: Production deployment detected (DEBUG=False) with missing or "
                    "insecure JWT_SECRET_KEY. Must provide a secure 32+ character random secret."
                )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )


# Which setting holds each provider's API key.
PROVIDER_KEY_SETTINGS = {
    "gemini": "GEMINI_API_KEY",
    "groq": "GROQ_API_KEY",
    "openrouter": "OPENROUTER_API_KEY",
}


def provider_api_key(settings: Any, provider_name: str) -> Optional[str]:
    """Return the configured API key for a provider, or None. Tolerates partial settings objects."""
    attr = PROVIDER_KEY_SETTINGS.get(provider_name.lower().strip())
    return getattr(settings, attr, None) if attr else None


@lru_cache()
def get_settings() -> Settings:
    """Return a cached singleton instance of application settings."""
    return Settings()
