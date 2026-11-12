from typing import Dict, Type
from app.core.config import get_settings, provider_api_key
from app.providers.base import BaseLLMProvider, ProviderResult
from app.providers.gemini import GeminiProvider
from app.providers.groq import GroqProvider
from app.providers.openrouter import OpenRouterProvider

PROVIDER_CLASSES: Dict[str, Type[BaseLLMProvider]] = {
    "gemini": GeminiProvider,
    "groq": GroqProvider,
    "openrouter": OpenRouterProvider,
}


def get_provider(provider_name: str) -> BaseLLMProvider:
    """Factory helper to obtain an initialized provider instance with configured credentials."""
    settings = get_settings()
    provider_cls = PROVIDER_CLASSES.get(provider_name.lower())
    if not provider_cls:
        raise ValueError(f"Unsupported AI provider: {provider_name}")

    return provider_cls(api_key=provider_api_key(settings, provider_name))


__all__ = [
    "BaseLLMProvider",
    "ProviderResult",
    "GeminiProvider",
    "GroqProvider",
    "OpenRouterProvider",
    "PROVIDER_CLASSES",
    "get_provider",
]
