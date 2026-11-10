from typing import Any, Dict
from fastapi import APIRouter
from app.core.config import get_settings

router = APIRouter()
settings = get_settings()


@router.get("", summary="Health Check", response_model=Dict[str, Any])
async def health_check() -> Dict[str, Any]:
    """Confirm that the ModelFit backend service is running and healthy."""
    return {
        "status": "healthy",
        "application": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }
