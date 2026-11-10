from fastapi.testclient import TestClient

_SYS = "You are a helpful assistant."


def _make_project(client: TestClient, name: str = "Test Project") -> str:
    """Helper: create a project and return its ID."""
    res = client.post(
        "/api/v1/projects",
        json={"name": name, "system_prompt": _SYS},
    )
    assert res.status_code == 201, f"Project creation failed: {res.json()}"
    return res.json()["id"]


def test_create_benchmark_success(client: TestClient):
    """Test creating a benchmark for an existing project."""
    project_id = _make_project(client, "Legal QA Project")

    payload = {
        "project_id": project_id,
        "name": "Q1 Model Evaluation",
        "description": "Compare Gemini vs GPT-4o on contract analysis",
        "selected_models": ["gemini-1.5-pro", "gpt-4o"],
    }
    response = client.post("/api/v1/benchmarks", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert data["name"] == payload["name"]
    assert data["project_id"] == project_id
    assert data["selected_models"] == ["gemini-1.5-pro", "gpt-4o"]
    assert data["status"] == "pending"
    assert "id" in data


def test_create_benchmark_nonexistent_project_fails(client: TestClient):
    """Test creating a benchmark referencing a non-existent project returns 404."""
    payload = {
        "project_id": "00000000-0000-0000-0000-000000000000",
        "name": "Ghost Project Benchmark",
        "selected_models": ["gpt-4o"],
    }
    response = client.post("/api/v1/benchmarks", json=payload)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "ENTITY_NOT_FOUND"


def test_get_benchmark_by_id(client: TestClient):
    """Test retrieving benchmark details by ID."""
    project_id = _make_project(client, "Test Project")

    b_res = client.post(
        "/api/v1/benchmarks",
        json={
            "project_id": project_id,
            "name": "Speed Benchmark",
            "selected_models": ["llama-3.3-70b-versatile"],
        },
    )
    assert b_res.status_code == 201
    benchmark_id = b_res.json()["id"]

    get_res = client.get(f"/api/v1/benchmarks/{benchmark_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == benchmark_id
    assert get_res.json()["name"] == "Speed Benchmark"


def test_update_benchmark_status(client: TestClient):
    """Test updating the lifecycle status of a benchmark."""
    project_id = _make_project(client, "Status Project")

    b_res = client.post(
        "/api/v1/benchmarks",
        json={
            "project_id": project_id,
            "name": "Lifecycle Benchmark",
            "selected_models": ["gemini-1.5-flash"],
        },
    )
    assert b_res.status_code == 201
    benchmark_id = b_res.json()["id"]
    assert b_res.json()["status"] == "pending"

    # Update to running
    patch_res = client.patch(
        f"/api/v1/benchmarks/{benchmark_id}",
        json={"status": "running"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "running"

    # Update to completed
    patch_res = client.patch(
        f"/api/v1/benchmarks/{benchmark_id}",
        json={"status": "completed"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "completed"


def test_update_benchmark_invalid_status_fails(client: TestClient):
    """Test that setting an unknown status returns a 400 validation error."""
    project_id = _make_project(client, "Invalid Status Project")

    b_res = client.post(
        "/api/v1/benchmarks",
        json={
            "project_id": project_id,
            "name": "Test Benchmark",
            "selected_models": ["gpt-4o"],
        },
    )
    assert b_res.status_code == 201
    benchmark_id = b_res.json()["id"]

    patch_res = client.patch(
        f"/api/v1/benchmarks/{benchmark_id}",
        json={"status": "flying"},
    )
    assert patch_res.status_code == 400
    assert patch_res.json()["error"]["code"] == "VALIDATION_ERROR"
