from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.providers import registry


@pytest.fixture
def isolated_registry():
    """Keep registry state local to each test."""
    original = registry._provider_registry.copy()
    registry._provider_registry.clear()
    yield
    registry._provider_registry.clear()
    registry._provider_registry.update(original)


def test_initialize_providers_registers_gemini_and_groq_with_configured_keys(
    monkeypatch, isolated_registry
):
    settings = SimpleNamespace(
        GEMINI_API_KEY="gemini-test-key",
        GROQ_API_KEY="groq-test-key",
    )
    monkeypatch.setattr(registry, "get_settings", Mock(return_value=settings))

    gemini = SimpleNamespace(provider_name="gemini")
    groq = SimpleNamespace(provider_name="groq")
    gemini_constructor = Mock(return_value=gemini)
    groq_constructor = Mock(return_value=groq)
    monkeypatch.setattr(registry, "GeminiProvider", gemini_constructor)
    monkeypatch.setattr(registry, "GroqProvider", groq_constructor)

    registry.initialize_providers()

    gemini_constructor.assert_called_once_with(api_key="gemini-test-key")
    groq_constructor.assert_called_once_with(api_key="groq-test-key")
    assert registry.get_all_providers() == {"gemini": gemini, "groq": groq}


@pytest.mark.parametrize("name", ["gemini", "groq"])
def test_get_provider_returns_registered_provider(name, isolated_registry):
    provider = SimpleNamespace(provider_name=name)
    registry.register_provider(provider)

    assert registry.get_provider(name) is provider


def test_get_provider_raises_for_unknown_provider(isolated_registry):
    with pytest.raises(ValueError, match="unknown.*not registered"):
        registry.get_provider("unknown")


def test_get_all_providers_returns_copy_of_registered_providers(isolated_registry):
    gemini = SimpleNamespace(provider_name="gemini")
    groq = SimpleNamespace(provider_name="groq")
    registry.register_provider(gemini)
    registry.register_provider(groq)

    providers = registry.get_all_providers()

    assert providers == {"gemini": gemini, "groq": groq}
    providers.clear()
    assert registry.get_all_providers() == {"gemini": gemini, "groq": groq}
