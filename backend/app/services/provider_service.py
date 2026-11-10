from typing import List, Optional
from app.core.config import get_settings
from app.core.exceptions import EntityNotFoundException
from app.providers import PROVIDER_CLASSES
from app.schemas.provider import ProviderResponse


class ProviderService:
    """Service layer managing AI model provider registries and configurations."""

    # Static catalog metadata for known providers
    _METADATA = {
        "gemini": {
            "display_name": "Google Gemini",
            "description": "Next-generation multimodal reasoning and long-context LLMs by Google DeepMind.",
            "default_model": "gemini-3.1-flash-lite",
        },
        "groq": {
            "display_name": "Groq",
            "description": "Ultra-low-latency LPU-powered inference for open-weight models (Qwen, GPT-OSS).",
            "default_model": "qwen/qwen3.8-27b",
        },
    }

    @classmethod
    def _is_configured(cls, provider_name: str) -> bool:
        settings = get_settings()
        if provider_name == "gemini":
            return bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip())
        elif provider_name == "groq":
            return bool(settings.GROQ_API_KEY and settings.GROQ_API_KEY.strip())
        return False

    @classmethod
    def get_all_providers(cls) -> List[ProviderResponse]:
        """Return metadata for all registered providers without exposing sensitive keys."""
        providers = []
        for name, provider_cls in PROVIDER_CLASSES.items():
            meta = cls._METADATA.get(name, {})
            # Instantiate temporary instance to query supported models
            instance = provider_cls(api_key=None)
            providers.append(
                ProviderResponse(
                    name=name,
                    display_name=meta.get("display_name", instance.display_name),
                    description=meta.get("description"),
                    is_configured=cls._is_configured(name),
                    is_active=True,
                    supported_models=instance.supported_models,
                    default_model=meta.get("default_model", instance.default_model),
                )
            )
        return providers

    @classmethod
    def get_provider_by_name(cls, provider_name: str) -> ProviderResponse:
        """Fetch provider metadata by name or raise EntityNotFoundException."""
        normalized = provider_name.lower().strip()
        if normalized not in PROVIDER_CLASSES:
            raise EntityNotFoundException("Provider", provider_name)

        provider_cls = PROVIDER_CLASSES[normalized]
        meta = cls._METADATA.get(normalized, {})
        instance = provider_cls(api_key=None)

        return ProviderResponse(
            name=normalized,
            display_name=meta.get("display_name", instance.display_name),
            description=meta.get("description"),
            is_configured=cls._is_configured(normalized),
            is_active=True,
            supported_models=instance.supported_models,
            default_model=meta.get("default_model", instance.default_model),
        )
