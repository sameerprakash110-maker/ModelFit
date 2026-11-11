from dataclasses import dataclass
from datetime import datetime, timezone
import threading
from typing import Dict, Optional

from fastapi import HTTPException, status

from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.schemas.auth import Token, UserCreate, UserLogin, UserResponse
from app.utils.helpers import generate_uuid, utc_now
from app.utils.logger import logger


@dataclass
class UserRecord:
    """Internal user entity with Argon2id password hash."""
    id: str
    email: str
    hashed_password: str
    full_name: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    def to_response(self) -> UserResponse:
        return UserResponse(
            id=self.id,
            email=self.email,
            full_name=self.full_name,
            is_active=self.is_active,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )


class AuthService:
    """Authentication service managing user registration, verification and JWT issuance."""

    # Thread-safe in-memory user registry protecting against concurrent access
    _lock = threading.RLock()
    _users: Dict[str, UserRecord] = {}  # user_id -> UserRecord
    _email_index: Dict[str, str] = {}   # normalized_email -> user_id

    @classmethod
    def reset_store(cls) -> None:
        """Clear user store for test isolation."""
        with cls._lock:
            cls._users.clear()
            cls._email_index.clear()

    @classmethod
    def normalize_email(cls, email: str) -> str:
        """Normalize email address to lowercase and stripped string."""
        return email.strip().lower()

    @classmethod
    def create_user(cls, user_in: UserCreate) -> UserResponse:
        """Register a new user with Argon2id hashed password."""
        normalized_email = cls.normalize_email(str(user_in.email))

        if len(user_in.password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 8 characters long",
            )

        with cls._lock:
            if normalized_email in cls._email_index:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A user with this email already exists",
                )

            user_id = generate_uuid()
            now = utc_now()
            hashed_pwd = hash_password(user_in.password)

            record = UserRecord(
                id=user_id,
                email=normalized_email,
                hashed_password=hashed_pwd,
                full_name=user_in.full_name,
                is_active=True,
                created_at=now,
                updated_at=now,
            )

            cls._users[user_id] = record
            cls._email_index[normalized_email] = user_id

        logger.info(f"Created new user account: {user_id} ({normalized_email})")
        return record.to_response()

    @classmethod
    def authenticate_user(cls, user_in: UserLogin) -> UserResponse:
        """Authenticate user by email and password, returning user profile."""
        normalized_email = cls.normalize_email(str(user_in.email))

        with cls._lock:
            user_id = cls._email_index.get(normalized_email)
            record = cls._users.get(user_id) if user_id else None

        if not record or not verify_password(user_in.password, record.hashed_password):
            logger.warning(f"Failed login attempt for email: {normalized_email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not record.is_active:
            logger.warning(f"Login rejected for disabled user: {record.id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user account",
            )

        logger.info(f"User authenticated successfully: {record.id}")
        return record.to_response()

    @classmethod
    def get_user_by_id(cls, user_id: str) -> Optional[UserResponse]:
        """Fetch user by primary UUID."""
        with cls._lock:
            record = cls._users.get(user_id)
            return record.to_response() if record else None

    @classmethod
    def get_user_record_by_id(cls, user_id: str) -> Optional[UserRecord]:
        """Fetch internal user record including active status."""
        with cls._lock:
            return cls._users.get(user_id)

    @classmethod
    def get_user_by_email(cls, email: str) -> Optional[UserResponse]:
        """Fetch user by email address."""
        normalized_email = cls.normalize_email(email)
        with cls._lock:
            user_id = cls._email_index.get(normalized_email)
            if not user_id:
                return None
            record = cls._users.get(user_id)
            return record.to_response() if record else None

    @classmethod
    def set_user_active(cls, user_id: str, is_active: bool) -> None:
        """Update active status of a user."""
        with cls._lock:
            record = cls._users.get(user_id)
            if record:
                record.is_active = is_active
                record.updated_at = utc_now()

    @classmethod
    def create_user_token(cls, user: UserResponse) -> Token:
        """Generate JWT access token for user."""
        access_token = create_access_token(subject=user.id)
        return Token(
            access_token=access_token,
            token_type="bearer",
            user=user,
        )
