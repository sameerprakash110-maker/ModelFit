from fastapi.testclient import TestClient


def test_create_project_success(client: TestClient):
    """Test successful creation of a new benchmarking project."""
    payload = {
        "name": "Customer Support Triage",
        "description": "Benchmark models on multi-turn customer support chats.",
        "business_domain": "Customer Experience",
        "system_prompt": "You are a professional customer support agent.",
    }
    response = client.post("/api/v1/projects", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert data["name"] == payload["name"]
    assert data["description"] == payload["description"]
    assert data["business_domain"] == payload["business_domain"]
    assert data["system_prompt"] == payload["system_prompt"]
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


def test_create_project_invalid_payload(client: TestClient):
    """Test project creation with missing or empty required name field."""
    # Empty name violates min_length=1
    response = client.post("/api/v1/projects", json={"name": ""})
    assert response.status_code == 422

    # Missing name completely
    response = client.post("/api/v1/projects", json={"description": "Missing name"})
    assert response.status_code == 422


def test_get_project_by_id(client: TestClient):
    """Test retrieving an existing project by its ID."""
    create_res = client.post(
        "/api/v1/projects",
        json={"name": "Financial Document Summarization", "business_domain": "Finance"},
    )
    assert create_res.status_code == 201
    project_id = create_res.json()["id"]

    get_res = client.get(f"/api/v1/projects/{project_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == project_id
    assert get_res.json()["name"] == "Financial Document Summarization"


def test_get_nonexistent_project_returns_404(client: TestClient):
    """Test that querying a non-existent project UUID returns 404."""
    non_existent_id = "00000000-0000-0000-0000-000000000000"
    response = client.get(f"/api/v1/projects/{non_existent_id}")
    assert response.status_code == 404
    data = response.json()
    assert data["error"]["code"] == "ENTITY_NOT_FOUND"


def test_update_project(client: TestClient):
    """Test updating project details."""
    create_res = client.post(
        "/api/v1/projects",
        json={"name": "Initial Name", "description": "Old description"},
    )
    project_id = create_res.json()["id"]

    update_res = client.put(
        f"/api/v1/projects/{project_id}",
        json={"name": "Updated Name", "business_domain": "Healthcare"},
    )
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["name"] == "Updated Name"
    assert updated_data["description"] == "Old description"
    assert updated_data["business_domain"] == "Healthcare"


def test_delete_project(client: TestClient):
    """Test deleting an existing project."""
    create_res = client.post(
        "/api/v1/projects",
        json={"name": "Project to Delete"},
    )
    project_id = create_res.json()["id"]

    delete_res = client.delete(f"/api/v1/projects/{project_id}")
    assert delete_res.status_code == 204

    # Verify project no longer exists
    get_res = client.get(f"/api/v1/projects/{project_id}")
    assert get_res.status_code == 404


def test_list_projects(client: TestClient):
    """Test listing multiple projects."""
    client.post("/api/v1/projects", json={"name": "Project Alpha"})
    client.post("/api/v1/projects", json={"name": "Project Beta"})

    res = client.get("/api/v1/projects")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 2
    names = [p["name"] for p in data]
    assert "Project Alpha" in names
    assert "Project Beta" in names
