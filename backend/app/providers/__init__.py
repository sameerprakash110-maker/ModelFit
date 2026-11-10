from typing import Dict, Type
from app.core.config import get_settings
from app.providers.base import BaseLLMProvider, ProviderResult
from app.providers.gemini import GeminiProvider
from app.providers.groq import GroqProvider

PROVIDER_CLASSES: Dict[str, Type[BaseLLMProvider]] = {
    "gemini": GeminiProvider,
    "groq": GroqProvider,
}


def get_provider(provider_name: str) -> BaseLLMProvider:
    """Factory helper to obtain an initialized provider instance with configured credentials."""
    settings = get_settings()
    provider_cls = PROVIDER_CLASSES.get(provider_name.lower())
    if not provider_cls:
        raise ValueError(f"Unsupported AI provider: {provider_name}")

    api_key = None
    if provider_name.lower() == "gemini":
        api_key = settings.GEMINI_API_KEY
    elif provider_name.lower() == "groq":
        api_key = settings.GROQ_API_KEY

    return provider_cls(api_key=api_key)


__all__ = [
    "BaseLLMProvider",
    "ProviderResult",
    "GeminiProvider",
    "GroqProvider",
    "PROVIDER_CLASSES",
    "get_provider",
]
