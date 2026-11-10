import asyncio

from app.providers.gemini import GeminiProvider


async def main():

    gemini = GeminiProvider()

    if not gemini.is_configured():
        print("Gemini API key is missing!")
        return

    print("Testing Gemini API...")

    result = await gemini.generate(
        prompt="Explain artificial intelligence in two sentences.",
        model_name="gemini-3.1-flash-lite"
    )

    print("\n========== GEMINI RESULT ==========")

    print("Provider:", result.provider_name)
    print("Model:", result.model_name)
    print("Status:", result.status)
    print("Response:", result.response_text)
    print("Input tokens:", result.input_tokens)
    print("Output tokens:", result.output_tokens)
    print("Latency:", result.latency_ms, "ms")
    print("Error:", result.error_message)


asyncio.run(main())