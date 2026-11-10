import uuid
from datetime import datetime, timezone
from typing import Optional


def generate_uuid() -> str:
    """Generate a random UUID4 string."""
    return str(uuid.uuid4())


def is_valid_uuid(val: str) -> bool:
    """Validate if the string is a valid UUID."""
    try:
        uuid.UUID(str(val))
        return True
    except (ValueError, AttributeError):
        return False


def utc_now() -> datetime:
    """Return the current timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)
