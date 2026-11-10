import asyncio
import httpx

from app.core.config import get_settings


async def main():

    settings = get_settings()

    url = "https://generativelanguage.googleapis.com/v1beta/models"

    headers = {
        "x-goog-api-key": settings.GEMINI_API_KEY
    }

    async with httpx.AsyncClient(timeout=30.0) as client:

        response = await client.get(url, headers=headers)

        print("Status:", response.status_code)

        response.raise_for_status()

        data = response.json()

        print("\nAvailable Gemini models:\n")

        for model in data.get("models", []):

            if "generateContent" in model.get("supportedGenerationMethods", []):

                print(
                    model["name"],
                    "-",
                    model.get("displayName", "")
                )


asyncio.run(main())