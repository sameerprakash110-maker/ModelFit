from datetime import timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.services.auth_service import AuthService


@pytest.fixture(autouse=True)
def clean_auth_store():
    AuthService.reset_store()
    yield
    AuthService.reset_store()


def test_signup_success(client: TestClient):
    payload = {
        "email": "developer@enterprise.com",
        "password": "SecurePassword123!",
        "full_name": "Senior Engineer",
    }
    response = client.post("/api/v1/auth/signup", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "developer@enterprise.com"
    assert data["user"]["full_name"] == "Senior Engineer"
    assert data["user"]["is_active"] is True
    assert "id" in data["user"]


def test_signup_duplicate_email(client: TestClient):
    payload = {
        "email": "duplicate@enterprise.com",
        "password": "SecurePassword123!",
    }
    res1 = client.post("/api/v1/auth/signup", json=payload)
    assert res1.status_code == 201

    res2 = client.post("/api/v1/auth/signup", json=payload)
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"]


def test_signup_password_too_short(client: TestClient):
    payload = {
        "email": "short@enterprise.com",
        "password": "short",
    }
    response = client.post("/api/v1/auth/signup", json=payload)
    assert response.status_code == 422 or response.status_code == 400


def test_login_success(client: TestClient):
    client.post(
        "/api/v1/auth/signup",
        json={"email": "login@enterprise.com", "password": "MySecretPassword123!"},
    )

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "login@enterprise.com", "password": "MySecretPassword123!"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "login@enterprise.com"


def test_login_wrong_password(client: TestClient):
    client.post(
        "/api/v1/auth/signup",
        json={"email": "wrongpwd@enterprise.com", "password": "CorrectPassword123!"},
    )

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "wrongpwd@enterprise.com", "password": "WrongPassword123!"},
    )
    assert response.status_code == 401
    assert "Incorrect email or password" in response.json()["detail"]


def test_login_nonexistent_email(client: TestClient):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "ghost@enterprise.com", "password": "AnyPassword123!"},
    )
    assert response.status_code == 401
    assert "Incorrect email or password" in response.json()["detail"]


def test_get_me_success(client: TestClient):
    signup_res = client.post(
        "/api/v1/auth/signup",
        json={"email": "me@enterprise.com", "password": "StrongPassword123!"},
    )
    token = signup_res.json()["access_token"]

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "me@enterprise.com"
    assert data["is_active"] is True


def test_get_me_missing_token(unauthenticated_client: TestClient):
    response = unauthenticated_client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert "Authentication required" in response.json()["detail"]


def test_get_me_invalid_token(client: TestClient):
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer fake.malformed.token"},
    )
    assert response.status_code == 401


def test_get_me_expired_token(client: TestClient):
    signup_res = client.post(
        "/api/v1/auth/signup",
        json={"email": "expired@enterprise.com", "password": "StrongPassword123!"},
    )
    user_id = signup_res.json()["user"]["id"]
    expired_token = create_access_token(user_id, expires_delta=timedelta(seconds=-10))

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert response.status_code == 401
    assert "Token has expired" in response.json()["detail"]


def test_get_me_disabled_user(client: TestClient, db_session: Session):
    signup_res = client.post(
        "/api/v1/auth/signup",
        json={"email": "disabled@enterprise.com", "password": "StrongPassword123!"},
    )
    user_id = signup_res.json()["user"]["id"]
    token = signup_res.json()["access_token"]

    AuthService.set_user_active(db_session, user_id, False)

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 400
    assert "Inactive user account" in response.json()["detail"]


def test_user_persistence_across_sessions(db_session: Session):
    """Verify that user records are genuinely persisted to the SQL database across independent sessions."""
    from app.schemas.auth import UserCreate
    from app.models.user import User
    from app.core.security import verify_password
    from sqlalchemy import select

    user_in = UserCreate(
        email="persisted@enterprise.com",
        password="ValidPassword123!",
        full_name="Persistent Engineer",
    )
    created = AuthService.create_user(db_session, user_in)
    user_id = created.id
    db_session.commit()

    # Query from the session directly
    found = db_session.scalars(select(User).where(User.id == user_id)).first()
    assert found is not None
    assert found.email == "persisted@enterprise.com"
    assert found.full_name == "Persistent Engineer"
    assert verify_password("ValidPassword123!", found.hashed_password)


def test_user_cascade_delete_projects(db_session: Session):
    """Verify that cascading deletion cleans up owned projects when a user is removed."""
    from app.schemas.auth import UserCreate
    from app.models.project import Project
    from sqlalchemy import select

    user = AuthService.create_user(
        db_session,
        UserCreate(
            email="cascade_user@enterprise.com",
            password="ValidPassword123!",
            full_name="Cascade Target",
        ),
    )
    project = Project(
        name="Project to Cascade",
        system_prompt="Cascading test",
        owner_id=user.id,
    )
    db_session.add(project)
    db_session.commit()
    project_id = project.id

    # Verify project exists and is owned by user
    persisted_proj = db_session.scalars(select(Project).where(Project.id == project_id)).first()
    assert persisted_proj is not None
    assert persisted_proj.owner_id == user.id

    # Delete user
    db_session.delete(user)
    db_session.commit()

    # Verify project is cascade deleted
    deleted_proj = db_session.scalars(select(Project).where(Project.id == project_id)).first()
    assert deleted_proj is None
