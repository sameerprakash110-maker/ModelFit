from typing import Optional


def mask_api_key(key: Optional[str], visible_chars: int = 4) -> str:
    """Mask sensitive API keys for safe display in administrative logs or metadata.

    Example: 'sk-abcdef1234567890' -> 'sk-...7890'
    """
    if not key:
        return "Not Configured"
    if len(key) <= visible_chars * 2:
        return "****"
    return f"{key[:visible_chars]}...{key[-visible_chars:]}"


def is_valid_api_key(key: Optional[str]) -> bool:
    """Check if an API key string exists and appears non-empty."""
    return bool(key and key.strip())
