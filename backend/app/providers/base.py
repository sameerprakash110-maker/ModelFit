from abc import ABC, abstractmethod

from app.schemas.provider import ProviderResult


class BaseLLMProvider(ABC):

    provider_name: str = ""
    display_name: str = ""
    supported_models: list[str] = []

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        model_name: str
    ) -> ProviderResult:

        pass

    @abstractmethod
    def is_configured(self) -> bool:

        pass