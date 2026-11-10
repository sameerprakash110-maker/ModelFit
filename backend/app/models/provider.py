from typing import List, Optional
from sqlalchemy import Boolean, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class Provider(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Represents an AI model provider configuration and capability registry."""

    __tablename__ = "providers"

    name: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    supported_models: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)

    def __repr__(self) -> str:
        return f"<Provider(id={self.id}, name='{self.name}', active={self.is_active})>"
