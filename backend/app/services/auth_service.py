from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.auth import Token, UserCreate, UserLogin, UserResponse
from app.utils.logger import logger


class AuthService:
    """Persistent database-backed authentication and account service."""

    @classmethod
    def reset_store(cls) -> None:
        """Retained for compatibility; test fixtures isolate users by resetting the database."""

    @classmethod
    def normalize_email(cls, email: str) -> str:
        return email.strip().lower()

    @classmethod
    def create_user(cls, db: Session, user_in: UserCreate) -> User:
        normalized_email = cls.normalize_email(str(user_in.email))
        if len(user_in.password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 8 characters long",
            )

        user = User(
            email=normalized_email,
            hashed_password=hash_password(user_in.password),
            full_name=user_in.full_name,
            is_active=True,
        )
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email already exists",
            )
        db.refresh(user)
        logger.info("Persisted new user account: %s (%s)", user.id, normalized_email)
        return user

    @classmethod
    def authenticate_user(cls, db: Session, user_in: UserLogin) -> User:
        normalized_email = cls.normalize_email(str(user_in.email))
        user = db.scalar(select(User).where(User.email == normalized_email))
        if not user or not verify_password(user_in.password, user.hashed_password):
            logger.warning("Failed login attempt for email: %s", normalized_email)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if not user.is_active:
            logger.warning("Login rejected for disabled user: %s", user.id)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user account",
            )
        logger.info("User authenticated successfully: %s", user.id)
        return user

    @classmethod
    def get_user_by_id(cls, db: Session, user_id: str) -> Optional[User]:
        return db.scalar(select(User).where(User.id == user_id))

    @classmethod
    def get_user_by_email(cls, db: Session, email: str) -> Optional[User]:
        normalized_email = cls.normalize_email(email)
        return db.scalar(select(User).where(User.email == normalized_email))

    @classmethod
    def set_user_active(cls, db: Session, user_id: str, is_active: bool) -> None:
        user = cls.get_user_by_id(db, user_id)
        if user:
            user.is_active = is_active
            db.commit()
            db.refresh(user)

    @classmethod
    def create_user_token(cls, user: User) -> Token:
        user_response = UserResponse.model_validate(user)
        return Token(
            access_token=create_access_token(subject=user.id),
            token_type="bearer",
            user=user_response,
        )
