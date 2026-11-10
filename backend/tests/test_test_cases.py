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


def test_create_test_case_success(client: TestClient):
    """Test creating a test case associated with a project."""
    project_id = _make_project(client, "Coding Assistant")

    payload = {
        "project_id": project_id,
        "input_prompt": "Write a Python function to compute Fibonacci numbers using memoization.",
        "expected_behavior": "Should return an efficient O(n) solution using dict or functools.lru_cache.",
        # evaluation_criteria is now a JSON dict
        "evaluation_criteria": {
            "correctness": "Must return correct Fibonacci numbers",
            "time_complexity": "Must be O(n) or better",
            "style": "Should use Pythonic type hints",
        },
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


def test_create_test_case_without_evaluation_criteria(client: TestClient):
    """Test that evaluation_criteria is optional — omitting it is valid."""
    project_id = _make_project(client, "Minimal Test Project")

    res = client.post(
        "/api/v1/test-cases",
        json={
            "project_id": project_id,
            "input_prompt": "What is 2 + 2?",
            "expected_behavior": "Return 4.",
        },
    )
    assert res.status_code == 201
    assert res.json()["evaluation_criteria"] is None


def test_create_test_case_nonexistent_project_fails(client: TestClient):
    """Test creating a test case for a non-existent project returns 404."""
    payload = {
        "project_id": "00000000-0000-0000-0000-000000000000",
        "input_prompt": "What is 2 + 2?",
        "expected_behavior": "Return 4.",
    }
    response = client.post("/api/v1/test-cases", json=payload)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "ENTITY_NOT_FOUND"


def test_get_and_delete_test_case(client: TestClient):
    """Test retrieving and deleting a test case."""
    project_id = _make_project(client, "SQL Bot")

    tc_res = client.post(
        "/api/v1/test-cases",
        json={
            "project_id": project_id,
            "input_prompt": "Generate a SQL query for top 5 customers by sales.",
            "expected_behavior": "Return a valid SQL query.",
        },
    )
    assert tc_res.status_code == 201
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
