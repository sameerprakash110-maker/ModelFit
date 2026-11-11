from typing import List
from fastapi import APIRouter, Depends
from app.core.auth import get_current_active_user
from app.schemas.provider import ProviderHealthResponse, ProviderResponse
from app.services.provider_service import ProviderService
from app.services.provider_health_service import ProviderHealthService

router = APIRouter(dependencies=[Depends(get_current_active_user)])


@router.get(
    "",
    response_model=List[ProviderResponse],
    summary="List all AI providers",
)
def list_providers() -> List[ProviderResponse]:
    """Retrieve metadata and configuration statuses for all supported AI providers."""
    return ProviderService.get_all_providers()


@router.get(
    "/{provider_name}",
    response_model=ProviderResponse,
    summary="Get provider metadata",
)
def get_provider(provider_name: str) -> ProviderResponse:
    """Retrieve configuration status and supported models for a specific AI provider."""
    return ProviderService.get_provider_by_name(provider_name)


@router.get(
    "/{provider_name}/health",
    response_model=ProviderHealthResponse,
    summary="Check provider API health",
)
async def check_provider_health(provider_name: str) -> ProviderHealthResponse:
    """Check provider credentials and API reachability without generating output."""
    return await ProviderHealthService.check_health(provider_name)
