from fastapi.testclient import TestClient


def test_create_test_case_success(client: TestClient):
    """Test creating a test case associated with a project."""
    p_res = client.post("/api/v1/projects", json={"name": "Coding Assistant"})
    project_id = p_res.json()["id"]

    payload = {
        "project_id": project_id,
        "input_prompt": "Write a Python function to compute Fibonacci numbers using memoization.",
        "expected_behavior": "Should return an efficient O(n) solution using dict or functools.lru_cache.",
        "evaluation_criteria": "Correctness, time complexity, and Pythonic type hints.",
    }
    response = client.post("/api/v1/test-cases", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert data["project_id"] == project_id
    assert data["input_prompt"] == payload["input_prompt"]
    assert data["expected_behavior"] == payload["expected_behavior"]
    assert data["evaluation_criteria"] == payload["evaluation_criteria"]
    assert "id" in data
    assert "created_at" in data


def test_create_test_case_nonexistent_project_fails(client: TestClient):
    """Test creating a test case for a non-existent project returns 404."""
    payload = {
        "project_id": "00000000-0000-0000-0000-000000000000",
        "input_prompt": "What is 2 + 2?",
    }
    response = client.post("/api/v1/test-cases", json=payload)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "ENTITY_NOT_FOUND"


def test_get_and_delete_test_case(client: TestClient):
    """Test retrieving and deleting a test case."""
    p_res = client.post("/api/v1/projects", json={"name": "SQL Bot"})
    project_id = p_res.json()["id"]

    tc_res = client.post(
        "/api/v1/test-cases",
        json={
            "project_id": project_id,
            "input_prompt": "Generate a SQL query for top 5 customers by sales.",
        },
    )
    test_case_id = tc_res.json()["id"]

    # Get test case
    get_res = client.get(f"/api/v1/test-cases/{test_case_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == test_case_id

    # Delete test case
    del_res = client.delete(f"/api/v1/test-cases/{test_case_id}")
    assert del_res.status_code == 204

    # Verify 404
    assert client.get(f"/api/v1/test-cases/{test_case_id}").status_code == 404
