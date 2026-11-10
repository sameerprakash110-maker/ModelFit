import pytest

from app.providers import get_provider
from app.providers.gemini import GeminiProvider
from app.providers.groq import GroqProvider


def test_provider_factory():
    """Verify that provider factory instantiates correct provider subclasses."""

    gemini = get_provider("gemini")
    assert isinstance(gemini, GeminiProvider)
    assert gemini.provider_name == "gemini"

    groq = get_provider("groq")
    assert isinstance(groq, GroqProvider)
    assert groq.provider_name == "groq"

    with pytest.raises(ValueError):
        get_provider("invalid_provider")


def test_openai_provider_removed():
    """Verify OpenAI is no longer supported."""

    with pytest.raises(ValueError):
        get_provider("openai")


@pytest.mark.asyncio
async def test_provider_mock_generate():
    """Verify mock generation works for all supported providers."""

    for name in ["gemini", "groq"]:
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
async def test_gemini_mock_generate():
    """Verify Gemini mock generation works without an API key."""

    provider = get_provider("gemini")

    result = await provider.generate(
        prompt="Hello world",
        mock=True,
    )

    assert result.is_mock is True
    assert result.provider == "gemini"
    assert result.content


@pytest.mark.asyncio
async def test_groq_mock_generate():
    """Verify Groq mock generation works without an API key."""

    provider = get_provider("groq")

    result = await provider.generate(
        prompt="Hello world",
        mock=True,
    )

    assert result.is_mock is True
    assert result.provider == "groq"
    assert result.content