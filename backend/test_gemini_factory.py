import asyncio

from app.providers import get_provider


async def main():

    gemini = get_provider("gemini")

    result = await gemini.generate(
        prompt="Explain artificial intelligence in two sentences."
    )

    print("\n========== GEMINI FACTORY TEST ==========")

    print("Provider:", result.provider)
    print("Model:", result.model)
    print("Status:", "success" if result.content else "failed")
    print("Response:", result.content)
    print("Input tokens:", result.prompt_tokens)
    print("Output tokens:", result.completion_tokens)
    print("Latency:", result.latency_ms, "ms")
    print("Cost:", result.cost_usd)


asyncio.run(main())