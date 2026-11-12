from typing import Dict

from app.core.config import get_settings
from app.providers.base import BaseLLMProvider
from app.providers.gemini import GeminiProvider
from app.providers.groq import GroqProvider
from app.providers.openrouter import OpenRouterProvider

_provider_registry: Dict[str, BaseLLMProvider] = {}


def register_provider(provider: BaseLLMProvider):
    name = provider.provider_name.lower()

    if not name:
        raise ValueError("Provider name cannot be empty")

    _provider_registry[name] = provider


def get_provider(provider_name: str) -> BaseLLMProvider:
    name = provider_name.lower()
    provider = _provider_registry.get(name)

    if provider is None:
        raise ValueError(f"Provider '{name}' is not registered")

    return provider


def get_all_providers() -> Dict[str, BaseLLMProvider]:
    return _provider_registry.copy()


def initialize_providers():
    settings = get_settings()

    register_provider(
        GeminiProvider(api_key=settings.GEMINI_API_KEY)
    )

    register_provider(
        GroqProvider(api_key=settings.GROQ_API_KEY)
    )

    register_provider(
        OpenRouterProvider(api_key=getattr(settings, "OPENROUTER_API_KEY", None))
    )