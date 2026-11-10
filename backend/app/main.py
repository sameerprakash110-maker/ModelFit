from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.router import api_router
from app.core.config import get_settings
from app.core.database import init_db
from app.core.exceptions import register_exception_handlers
from app.utils.logger import logger

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan context manager for startup and shutdown routines."""
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION} [Debug: {settings.DEBUG}]")
    # Initialize SQLite database schema on startup if not present
    init_db()
    logger.info("Database initialized successfully.")
    yield
    logger.info(f"Shutting down {settings.APP_NAME}...")


def create_application() -> FastAPI:
    """Factory creating and configuring the FastAPI backend application."""
    app = FastAPI(
        title=f"{settings.APP_NAME} API",
        description=(
            "ModelFit – Enterprise AI Benchmarking & Auto-Tuning Platform.\n\n"
            "Benchmark multiple LLM providers (Gemini, OpenAI, Groq), track latency, "
            "token costs, evaluate with LLM-as-a-Judge, and optimize prompts."
        ),
        version=settings.APP_VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # Configure CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register custom exception handlers
    register_exception_handlers(app)

    # Mount API routers
    app.include_router(api_router)

    # Root redirect or greeting
    @app.get("/", include_in_schema=False)
    async def root():
        return {
            "application": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "documentation": "/docs",
            "health": f"{settings.API_V1_PREFIX}/health",
        }

    return app


app = create_application()
