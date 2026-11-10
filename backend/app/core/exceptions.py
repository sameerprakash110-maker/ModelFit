from typing import Any, Dict, Optional
from fastapi import Request, status
from fastapi.responses import JSONResponse


class ModelFitException(Exception):
    """Base exception for all ModelFit domain errors."""

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class EntityNotFoundException(ModelFitException):
    """Raised when a requested resource is not found."""

    def __init__(self, entity_name: str, entity_id: str):
        message = f"{entity_name} with identifier '{entity_id}' was not found."
        super().__init__(message, details={"entity": entity_name, "id": entity_id})


class EntityAlreadyExistsException(ModelFitException):
    """Raised when an entity with unique constraint already exists."""

    def __init__(self, entity_name: str, field: str, value: str):
        message = f"{entity_name} with {field}='{value}' already exists."
        super().__init__(message, details={"entity": entity_name, "field": field, "value": value})


class ValidationException(ModelFitException):
    """Raised when business validation rules fail."""

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, details=details)


class ProviderException(ModelFitException):
    """Raised when an AI provider encounter an error or is unconfigured."""

    def __init__(self, provider_name: str, message: str, details: Optional[Dict[str, Any]] = None):
        full_message = f"Provider '{provider_name}' error: {message}"
        super().__init__(full_message, details=details or {"provider": provider_name})


class BenchmarkExecutionException(ModelFitException):
    """Raised when benchmark runner encounters an execution error."""

    def __init__(self, benchmark_id: str, message: str):
        full_message = f"Benchmark '{benchmark_id}' execution failed: {message}"
        super().__init__(full_message, details={"benchmark_id": benchmark_id})


def register_exception_handlers(app: Any) -> None:
    """Register custom exception handlers on the FastAPI application."""

    @app.exception_handler(EntityNotFoundException)
    async def entity_not_found_handler(request: Request, exc: EntityNotFoundException):
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "error": {
                    "code": "ENTITY_NOT_FOUND",
                    "message": exc.message,
                    "details": exc.details,
                }
            },
        )

    @app.exception_handler(EntityAlreadyExistsException)
    async def entity_exists_handler(request: Request, exc: EntityAlreadyExistsException):
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "error": {
                    "code": "ENTITY_ALREADY_EXISTS",
                    "message": exc.message,
                    "details": exc.details,
                }
            },
        )

    @app.exception_handler(ValidationException)
    async def validation_handler(request: Request, exc: ValidationException):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": exc.message,
                    "details": exc.details,
                }
            },
        )

    @app.exception_handler(ProviderException)
    async def provider_handler(request: Request, exc: ProviderException):
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content={
                "error": {
                    "code": "PROVIDER_ERROR",
                    "message": exc.message,
                    "details": exc.details,
                }
            },
        )

    @app.exception_handler(ModelFitException)
    async def generic_modelfit_handler(request: Request, exc: ModelFitException):
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": "INTERNAL_DOMAIN_ERROR",
                    "message": exc.message,
                    "details": exc.details,
                }
            },
        )
