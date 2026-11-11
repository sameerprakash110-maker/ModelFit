from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import Token, UserCreate, UserLogin, UserResponse
from app.utils.logger import logger


class AuthService:
    """Persistent database-backed authentication service managing user registration, verification, and JWT issuance."""

    @classmethod
    def reset_store(cls) -> None:
        """Retained for test isolation compatibility."""
        pass

    @classmethod
    def normalize_email(cls, email: str) -> str:
        """Normalize email address to lowercase and stripped string."""
        return email.strip().lower()

    @classmethod
    def create_user(cls, db: Session, user_in: UserCreate) -> User:
        """Register a new user in the database with Argon2id hashed password."""
        normalized_email = cls.normalize_email(str(user_in.email))

        if len(user_in.password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 8 characters long",
            )

        # Enforce unique email constraint at service level
        existing = db.scalars(
            select(User).where(User.email == normalized_email)
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email already exists",
            )

        hashed_pwd = hash_password(user_in.password)
        user = User(
            email=normalized_email,
            hashed_password=hashed_pwd,
            full_name=user_in.full_name,
            is_active=True,
        )

        db.add(user)
        db.commit()
        db.refresh(user)

        logger.info(f"Persisted new user account: {user.id} ({normalized_email})")
        return user

    @classmethod
    def authenticate_user(cls, db: Session, user_in: UserLogin) -> User:
        """Authenticate user by email and password, returning persistent user entity."""
        normalized_email = cls.normalize_email(str(user_in.email))

        user = db.scalars(
            select(User).where(User.email == normalized_email)
        ).first()

        if not user or not verify_password(user_in.password, user.hashed_password):
            logger.warning(f"Failed login attempt for email: {normalized_email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not user.is_active:
            logger.warning(f"Login rejected for disabled user: {user.id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user account",
            )

        logger.info(f"User authenticated successfully: {user.id}")
        return user

    @classmethod
    def get_user_by_id(cls, db: Session, user_id: str) -> Optional[User]:
        """Fetch persistent user entity by primary UUID."""
        return db.scalars(select(User).where(User.id == user_id)).first()

    @classmethod
    def get_user_by_email(cls, db: Session, email: str) -> Optional[User]:
        """Fetch persistent user entity by normalized email address."""
        normalized_email = cls.normalize_email(email)
        return db.scalars(select(User).where(User.email == normalized_email)).first()

    @classmethod
    def set_user_active(cls, db: Session, user_id: str, is_active: bool) -> None:
        """Update active status of a user in the database."""
        user = cls.get_user_by_id(db, user_id)
        if user:
            user.is_active = is_active
            db.add(user)
            db.commit()
            db.refresh(user)

    @classmethod
    def create_user_token(cls, user: User) -> Token:
        """Generate JWT access token for user."""
        access_token = create_access_token(subject=user.id)
        user_response = UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            is_active=user.is_active,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )
        return Token(
            access_token=access_token,
            token_type="bearer",
            user=user_response,
        )
