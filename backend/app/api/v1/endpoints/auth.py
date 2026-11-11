from fastapi import APIRouter, Depends, status

from app.core.auth import get_current_active_user
from app.schemas.auth import Token, UserCreate, UserLogin, UserResponse
from app.services.auth_service import AuthService

router = APIRouter()


@router.post(
    "/signup",
    response_model=Token,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
def signup(user_in: UserCreate) -> Token:
    """Create a new user account, hash password using Argon2id, and return JWT access token."""
    user = AuthService.create_user(user_in)
    return AuthService.create_user_token(user)


@router.post(
    "/login",
    response_model=Token,
    summary="Authenticate user and receive JWT access token",
)
def login(user_in: UserLogin) -> Token:
    """Authenticate with email and password, returning a signed JWT access token."""
    user = AuthService.authenticate_user(user_in)
    return AuthService.create_user_token(user)


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Retrieve current authenticated user profile",
)
def get_me(current_user: UserResponse = Depends(get_current_active_user)) -> UserResponse:
    """Return the profile of the currently authenticated user."""
    return current_user
