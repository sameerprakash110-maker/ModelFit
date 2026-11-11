from fastapi.testclient import TestClient


def test_health_check(client: TestClient):
    """Test health check endpoint returns 200 and matches required response structure."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"
    assert data["application"] == "ModelFit"
    assert data["version"] == "1.0.0"


def test_openapi_schema_generation():
    """Verify OpenAPI schema generates cleanly without errors and includes all auth routes."""
    from app.main import app

    schema = app.openapi()
    assert schema["info"]["title"] == "ModelFit API"
    assert "/api/v1/auth/signup" in schema["paths"]
    assert "/api/v1/auth/login" in schema["paths"]
    assert "/api/v1/auth/me" in schema["paths"]
    assert "/api/v1/projects" in schema["paths"]
    assert "/api/v1/benchmarks" in schema["paths"]
    assert "/api/v1/reports/benchmark/{benchmark_id}" in schema["paths"]
