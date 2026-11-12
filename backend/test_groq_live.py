import asyncio

from app.providers import get_provider


async def main():

    provider = get_provider("groq")

    print("Provider:", provider.display_name)
    print("Available models:", provider.supported_models)
    print("Selected model:", provider.default_model)

    result = await provider.generate(
        prompt="Explain artificial intelligence in two sentences.",
        mock=False,
    )

    print("\nResponse:", result.content)
    print("Model:", result.model)
    print("Input tokens:", result.prompt_tokens)
    print("Output tokens:", result.completion_tokens)
    print("Latency:", result.latency_ms)
    print("Cost:", result.cost_usd)


if __name__ == "__main__":
    asyncio.run(main())