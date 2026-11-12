from typing import Optional

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin
from app.schemas.auth import UserResponse


class User(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A ModelFit account. Passwords are stored only as Argon2id hashes."""

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, server_default="1")

    def to_response(self) -> UserResponse:
        return UserResponse(
            id=self.id,
            email=self.email,
            full_name=self.full_name,
            is_active=self.is_active,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email='{self.email}')>"
