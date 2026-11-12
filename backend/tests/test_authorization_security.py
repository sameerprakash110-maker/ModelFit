import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.schemas.auth import UserCreate
from app.services.auth_service import AuthService


@pytest.fixture
def user_a_client(client: TestClient, db_session: Session) -> tuple[TestClient, str, str]:
    """Create User A and return (client, user_id, token)."""
    user_a = AuthService.create_user(
        db_session,
        UserCreate(
            email="usera@company.com",
            password="PasswordUserA123!",
            full_name="User Alpha",
        ),
    )
    token_a = create_access_token(user_a.id)
    return client, user_a.id, token_a


@pytest.fixture
def user_b_client(client: TestClient, db_session: Session) -> tuple[TestClient, str, str]:
    """Create User B and return (client, user_id, token)."""
    user_b = AuthService.create_user(
        db_session,
        UserCreate(
            email="userb@company.com",
            password="PasswordUserB123!",
            full_name="User Beta",
        ),
    )
    token_b = create_access_token(user_b.id)
    return client, user_b.id, token_b


def test_user_b_cannot_access_user_a_project(user_a_client, user_b_client):
    client, _, token_a = user_a_client
    _, _, token_b = user_b_client

    # User A creates a project
    res_a = client.post(
        "/api/v1/projects",
        json={
            "name": "User A Secret Project",
            "system_prompt": "You are a confidential assistant.",
        },
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res_a.status_code == 201
    project_a_id = res_a.json()["id"]

    # User A can access it
    res_get_a = client.get(
        f"/api/v1/projects/{project_a_id}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res_get_a.status_code == 200

    # User B CANNOT read User A's project (returns 404 Not Found to prevent leaking existence)
    res_get_b = client.get(
        f"/api/v1/projects/{project_a_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res_get_b.status_code == 404

    # User B CANNOT update User A's project
    res_put_b = client.put(
        f"/api/v1/projects/{project_a_id}",
        json={"name": "Hacked Project"},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res_put_b.status_code == 404

    # User B CANNOT delete User A's project
    res_del_b = client.delete(
        f"/api/v1/projects/{project_a_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res_del_b.status_code == 404


def test_user_b_cannot_access_user_a_test_cases(user_a_client, user_b_client):
    client, _, token_a = user_a_client
    _, _, token_b = user_b_client

    # User A creates project and test case
    p_res = client.post(
        "/api/v1/projects",
        json={"name": "Project for Test Cases", "system_prompt": "System prompt"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    project_id = p_res.json()["id"]

    tc_res = client.post(
        "/api/v1/test-cases",
        json={
            "project_id": project_id,
            "input_prompt": "Confidential prompt A",
            "expected_behavior": "Confidential answer A",
        },
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert tc_res.status_code == 201
    tc_id = tc_res.json()["id"]

    # User B cannot read test case by ID
    assert client.get(
        f"/api/v1/test-cases/{tc_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    ).status_code == 404

    # User B cannot update test case
    assert client.put(
        f"/api/v1/test-cases/{tc_id}",
        json={"input_prompt": "Tampered prompt"},
        headers={"Authorization": f"Bearer {token_b}"},
    ).status_code == 404

    # User B cannot delete test case
    assert client.delete(
        f"/api/v1/test-cases/{tc_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    ).status_code == 404

    # User B cannot create a test case inside User A's project
    assert client.post(
        "/api/v1/test-cases",
        json={
            "project_id": project_id,
            "input_prompt": "Unauthorized test case",
            "expected_behavior": "Expected",
        },
        headers={"Authorization": f"Bearer {token_b}"},
    ).status_code == 404


def test_user_b_cannot_access_user_a_benchmarks_and_reports(user_a_client, user_b_client):
    client, _, token_a = user_a_client
    _, _, token_b = user_b_client

    # User A creates project and benchmark
    p_res = client.post(
        "/api/v1/projects",
        json={"name": "Benchmark Auth Project", "system_prompt": "Prompt"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    project_id = p_res.json()["id"]

    # Create test case for project
    client.post(
        "/api/v1/test-cases",
        json={
            "project_id": project_id,
            "input_prompt": "Input prompt",
            "expected_behavior": "Expected behavior",
        },
        headers={"Authorization": f"Bearer {token_a}"},
    )

    b_res = client.post(
        "/api/v1/benchmarks",
        json={
            "project_id": project_id,
            "name": "User A Benchmark Run",
            "selected_models": ["gemini-2.5-flash"],
            "baseline_model": "gemini-2.5-flash",
            "repeats": 1,
        },
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert b_res.status_code == 201
    benchmark_id = b_res.json()["id"]

    # User B cannot get benchmark
    assert client.get(
        f"/api/v1/benchmarks/{benchmark_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    ).status_code == 404

    # User B cannot update benchmark
    assert client.patch(
        f"/api/v1/benchmarks/{benchmark_id}",
        json={"name": "Hacked Name"},
        headers={"Authorization": f"Bearer {token_b}"},
    ).status_code == 404

    # User B cannot run User A's benchmark
    assert client.post(
        f"/api/v1/benchmarks/{benchmark_id}/run",
        json={"mock": True},
        headers={"Authorization": f"Bearer {token_b}"},
    ).status_code == 404

    # User B cannot recover User A's benchmark
    assert client.post(
        f"/api/v1/benchmarks/{benchmark_id}/recover",
        headers={"Authorization": f"Bearer {token_b}"},
    ).status_code == 404

    # User B cannot get benchmark summary
    assert client.get(
        f"/api/v1/benchmarks/{benchmark_id}/summary",
        headers={"Authorization": f"Bearer {token_b}"},
    ).status_code == 404

    # User B cannot get benchmark report
    assert client.get(
        f"/api/v1/reports/benchmark/{benchmark_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    ).status_code == 404

    # User B cannot get benchmark ROI
    assert client.get(
        f"/api/v1/reports/roi/{benchmark_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    ).status_code == 404

    # User B cannot access evaluations for User A's benchmark
    assert client.get(
        f"/api/v1/evaluations/benchmark/{benchmark_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    ).status_code == 404


def test_project_listing_isolation_between_users(user_a_client, user_b_client):
    client, _, token_a = user_a_client
    _, _, token_b = user_b_client

    client.post(
        "/api/v1/projects",
        json={"name": "Alpha Only Project", "system_prompt": "Sys"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    client.post(
        "/api/v1/projects",
        json={"name": "Beta Only Project", "system_prompt": "Sys"},
        headers={"Authorization": f"Bearer {token_b}"},
    )

    list_a = client.get("/api/v1/projects", headers={"Authorization": f"Bearer {token_a}"}).json()
    names_a = [p["name"] for p in list_a]
    assert "Alpha Only Project" in names_a
    assert "Beta Only Project" not in names_a

    list_b = client.get("/api/v1/projects", headers={"Authorization": f"Bearer {token_b}"}).json()
    names_b = [p["name"] for p in list_b]
    assert "Beta Only Project" in names_b
    assert "Alpha Only Project" not in names_b


def test_unauthenticated_requests_rejected(unauthenticated_client: TestClient):
    # Verify 401 on protected endpoints without Authorization header
    assert unauthenticated_client.get("/api/v1/projects").status_code == 401
    assert unauthenticated_client.post("/api/v1/projects", json={"name": "X", "system_prompt": "Y"}).status_code == 401
    assert unauthenticated_client.get("/api/v1/benchmarks").status_code == 401
    assert unauthenticated_client.get("/api/v1/test-cases").status_code == 401
    assert unauthenticated_client.get("/api/v1/reports/benchmark/fake-id").status_code == 401
    assert unauthenticated_client.get("/api/v1/reports/roi/fake-id").status_code == 401
    assert unauthenticated_client.get("/api/v1/evaluations/fake-id").status_code == 401


def test_operational_limits_enforcement(user_a_client):
    client, _, token_a = user_a_client

    p_res = client.post(
        "/api/v1/projects",
        json={"name": "Limits Project", "system_prompt": "Prompt"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    project_id = p_res.json()["id"]

    # Create test case for project
    client.post(
        "/api/v1/test-cases",
        json={
            "project_id": project_id,
            "input_prompt": "Input prompt",
            "expected_behavior": "Expected behavior",
        },
        headers={"Authorization": f"Bearer {token_a}"},
    )

    # 1. More than 10 models rejected
    too_many_models = [f"model-{i}" for i in range(12)]
    b_res = client.post(
        "/api/v1/benchmarks",
        json={
            "project_id": project_id,
            "name": "Excessive Models Benchmark",
            "selected_models": too_many_models,
            "repeats": 1,
        },
        headers={"Authorization": f"Bearer {token_a}"},
    )
    # The run endpoint will reject it when attempting to run
    b_id = b_res.json()["id"]
    run_res = client.post(
        f"/api/v1/benchmarks/{b_id}/run",
        json={"mock": True},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert run_res.status_code == 400
    res_data = run_res.json()
    error_msg = res_data.get("error", {}).get("message") or res_data.get("detail", "")
    assert "exceeds limit" in error_msg.lower()


def test_project_ownership_survives_registry_reset(user_a_client, user_b_client):
    """Ownership is stored on the project row, so a restart (empty in-memory registry) keeps projects private."""
    from app.services.ownership_service import OwnershipService

    client, user_a_id, token_a = user_a_client
    _, _, token_b = user_b_client

    res = client.post(
        "/api/v1/projects",
        json={"name": "Persisted Owner Project", "system_prompt": "You are helpful."},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res.status_code == 201
    project_id = res.json()["id"]

    OwnershipService.reset_store()  # simulate a server restart

    listed_b = client.get("/api/v1/projects", headers={"Authorization": f"Bearer {token_b}"}).json()
    assert project_id not in [p["id"] for p in listed_b]
    assert client.get(
        f"/api/v1/projects/{project_id}", headers={"Authorization": f"Bearer {token_b}"}
    ).status_code == 404

    listed_a = client.get("/api/v1/projects", headers={"Authorization": f"Bearer {token_a}"}).json()
    assert project_id in [p["id"] for p in listed_a]
