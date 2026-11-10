from typing import Dict

from app.providers.base import BaseLLMProvider


_provider_registry: Dict[str, BaseLLMProvider] = {}


def register_provider(provider: BaseLLMProvider):
    """Register an AI provider."""

    name = provider.provider_name.lower()

    if not name:
        raise ValueError("Provider name cannot be empty")

    _provider_registry[name] = provider


def get_provider(provider_name: str) -> BaseLLMProvider:
    """Retrieve a registered AI provider."""

    name = provider_name.lower()

    provider = _provider_registry.get(name)

    if provider is None:
        raise ValueError(f"Provider '{name}' is not registered")

    return provider


def get_all_providers() -> Dict[str, BaseLLMProvider]:
    """Return all registered providers."""

    return _provider_registry.copy()


def initialize_providers():
    """Initialize and register all supported providers."""

    from app.providers.gemini import GeminiProvider

    register_provider(GeminiProvider())