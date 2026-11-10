from typing import List
from fastapi import APIRouter
from app.schemas.provider import ProviderResponse
from app.services.provider_service import ProviderService

router = APIRouter()


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
