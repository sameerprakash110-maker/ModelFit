from typing import Callable, Optional

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import Token, UserCreate, UserLogin, UserResponse
from app.utils.helpers import utc_now
from app.utils.logger import logger

# Kept as an alias so existing imports of UserRecord keep working.
UserRecord = User


class AuthService:
    """Authentication service managing user registration, verification and JWT issuance.

    Accounts are persisted in the `users` table. Each call opens its own short-lived
    session from `_session_factory`, which tests point at their isolated database.
    """

    _session_factory: Callable[[], Session] = SessionLocal

    @classmethod
    def _session(cls) -> Session:
        return cls._session_factory()

    @classmethod
    def reset_store(cls) -> None:
        """Delete all user accounts (test isolation only)."""
        try:
            with cls._session() as db:
                db.execute(delete(User))
                db.commit()
        except OperationalError:
            # Table not created yet; nothing to clear.
            pass

    @classmethod
    def normalize_email(cls, email: str) -> str:
        """Normalize email address to lowercase and stripped string."""
        return email.strip().lower()

    @classmethod
    def _find_by_email(cls, db: Session, normalized_email: str) -> Optional[User]:
        return db.scalar(select(User).where(User.email == normalized_email))

    @classmethod
    def create_user(cls, user_in: UserCreate) -> UserResponse:
        """Register a new user with Argon2id hashed password."""
        normalized_email = cls.normalize_email(str(user_in.email))

        if len(user_in.password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 8 characters long",
            )

        duplicate = HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists",
        )

        with cls._session() as db:
            if cls._find_by_email(db, normalized_email):
                raise duplicate

            record = User(
                email=normalized_email,
                hashed_password=hash_password(user_in.password),
                full_name=user_in.full_name,
                is_active=True,
            )
            db.add(record)
            try:
                db.commit()
            except IntegrityError:
                # Lost a race with a concurrent signup for the same email.
                db.rollback()
                raise duplicate
            db.refresh(record)

        logger.info(f"Created new user account: {record.id} ({normalized_email})")
        return record.to_response()

    @classmethod
    def authenticate_user(cls, user_in: UserLogin) -> UserResponse:
        """Authenticate user by email and password, returning user profile."""
        normalized_email = cls.normalize_email(str(user_in.email))

        with cls._session() as db:
            record = cls._find_by_email(db, normalized_email)

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
        record = cls.get_user_record_by_id(user_id)
        return record.to_response() if record else None

    @classmethod
    def get_user_record_by_id(cls, user_id: str) -> Optional[User]:
        """Fetch internal user record including active status."""
        with cls._session() as db:
            return db.get(User, user_id)

    @classmethod
    def get_user_by_email(cls, email: str) -> Optional[UserResponse]:
        """Fetch user by email address."""
        with cls._session() as db:
            record = cls._find_by_email(db, cls.normalize_email(email))
            return record.to_response() if record else None

    @classmethod
    def set_user_active(cls, user_id: str, is_active: bool) -> None:
        """Update active status of a user."""
        with cls._session() as db:
            record = db.get(User, user_id)
            if record:
                record.is_active = is_active
                record.updated_at = utc_now()
                db.commit()

    @classmethod
    def create_user_token(cls, user: UserResponse) -> Token:
        """Generate JWT access token for user."""
        access_token = create_access_token(subject=user.id)
        return Token(
            access_token=access_token,
            token_type="bearer",
            user=user,
        )
