from fastapi.testclient import TestClient
import pytest


def test_list_providers(client: TestClient):
    """Test retrieving all supported AI providers."""

    response = client.get("/api/v1/providers")
    assert response.status_code == 200

    data = response.json()

    assert isinstance(data, list)

    names = [p["name"] for p in data]

    assert set(names) == {"gemini", "groq", "openrouter"}
    assert len(names) == 3

    # Ensure sensitive fields are NEVER exposed
    for provider in data:
        assert "api_key" not in provider
        assert "secret" not in provider
        assert "is_configured" in provider
        assert "supported_models" in provider
        assert len(provider["supported_models"]) > 0


def test_get_specific_provider(client: TestClient):
    """Test retrieving metadata for supported providers."""

    for provider_name in ["gemini", "groq", "openrouter"]:
        res = client.get(f"/api/v1/providers/{provider_name}")

        assert res.status_code == 200

        data = res.json()

        assert data["name"] == provider_name
        assert data["display_name"]
        assert isinstance(data["supported_models"], list)
        assert data["default_model"] in data["supported_models"]


def test_get_unknown_provider_returns_404(client: TestClient):
    """Test querying an unsupported provider returns 404."""

    response = client.get("/api/v1/providers/unsupported-llm-corp")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "ENTITY_NOT_FOUND"


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/providers",
        "/api/v1/providers/gemini",
        "/api/v1/providers/gemini/health",
    ],
)
def test_provider_endpoints_require_authentication(unauthenticated_client, path):
    response = unauthenticated_client.get(path)

    assert response.status_code == 401


def test_openai_provider_is_removed(client: TestClient):
    """Verify OpenAI is no longer available as a provider."""

    response = client.get("/api/v1/providers/openai")

    assert response.status_code == 404
