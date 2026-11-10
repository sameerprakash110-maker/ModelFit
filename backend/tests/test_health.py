from fastapi.testclient import TestClient


def test_health_check(client: TestClient):
    """Test health check endpoint returns 200 and matches required response structure."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"
    assert data["application"] == "ModelFit"
    assert data["version"] == "1.0.0"
