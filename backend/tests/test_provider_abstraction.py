import pytest
from app.providers import get_provider
from app.providers.gemini import GeminiProvider
from app.providers.groq import GroqProvider
from app.providers.openai import OpenAIProvider


def test_provider_factory():
    """Verify that provider factory instantiates correct provider subclasses."""
    gemini = get_provider("gemini")
    assert isinstance(gemini, GeminiProvider)
    assert gemini.provider_name == "gemini"

    openai = get_provider("openai")
    assert isinstance(openai, OpenAIProvider)
    assert openai.provider_name == "openai"

    groq = get_provider("groq")
    assert isinstance(groq, GroqProvider)
    assert groq.provider_name == "groq"

    with pytest.raises(ValueError):
        get_provider("invalid_provider")


@pytest.mark.asyncio
async def test_provider_mock_generate():
    """Verify mock generate returns structured ProviderResult for all providers."""
    for name in ["gemini", "openai", "groq"]:
        provider = get_provider(name)
        result = await provider.generate(
            prompt="Hello world",
            mock=True,
        )
        assert result.provider == name
        assert result.is_mock is True
        assert result.content
        assert result.latency_ms > 0
        assert result.prompt_tokens > 0


@pytest.mark.asyncio
async def test_provider_live_generate_raises_not_implemented():
    """Verify that un-mocked live calls raise NotImplementedError (or ValueError if unconfigured) at this architecture stage."""
    for name in ["gemini", "openai", "groq"]:
        provider = get_provider(name)
        with pytest.raises((NotImplementedError, ValueError)):
            await provider.generate(prompt="Live test", mock=False)
