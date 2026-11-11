import base64
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import jwt
from cryptography.hazmat.primitives.kdf.argon2 import Argon2id
from app.core.config import get_settings

settings = get_settings()

# Standard Argon2id parameters
ARGON2_MEMORY_COST = 65536  # 64 MB
ARGON2_ITERATIONS = 2
ARGON2_LANES = 4
ARGON2_KEY_LEN = 32
ARGON2_SALT_LEN = 16


def hash_password(password: str) -> str:
    """Hash a plaintext password using Argon2id with cryptographically secure random salt."""
    if not password:
        raise ValueError("Password cannot be empty")

    salt = os.urandom(ARGON2_SALT_LEN)
    kdf = Argon2id(
        salt=salt,
        length=ARGON2_KEY_LEN,
        iterations=ARGON2_ITERATIONS,
        lanes=ARGON2_LANES,
        memory_cost=ARGON2_MEMORY_COST,
    )
    derived = kdf.derive(password.encode("utf-8"))

    salt_b64 = base64.b64encode(salt).decode("ascii")
    hash_b64 = base64.b64encode(derived).decode("ascii")

    return f"$argon2id$v=19$m={ARGON2_MEMORY_COST},t={ARGON2_ITERATIONS},p={ARGON2_LANES}${salt_b64}${hash_b64}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against an Argon2id formatted password hash."""
    if not plain_password or not hashed_password:
        return False

    pattern = r"^\$argon2id\$v=(\d+)\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/=]+)\$([A-Za-z0-9+/=]+)$"
    match = re.match(pattern, hashed_password)
    if not match:
        return False

    _, m_cost, t_iters, p_lanes, salt_b64, _ = match.groups()

    try:
        salt = base64.b64decode(salt_b64.encode("ascii"))
        expected_hash = base64.b64decode(match.group(6).encode("ascii"))
    except Exception:
        return False

    kdf = Argon2id(
        salt=salt,
        length=len(expected_hash),
        iterations=int(t_iters),
        lanes=int(p_lanes),
        memory_cost=int(m_cost),
    )

    try:
        kdf.verify(plain_password.encode("utf-8"), expected_hash)
        return True
    except Exception:
        return False


def create_access_token(
    subject: str,
    expires_delta: Optional[timedelta] = None,
    extra_claims: Optional[Dict[str, Any]] = None,
) -> str:
    """Create a signed JWT access token with expiration and subject claims."""
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode: Dict[str, Any] = {
        "sub": str(subject),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "type": "access",
    }
    if extra_claims:
        to_encode.update(extra_claims)

    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return encoded_jwt


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decode and validate a JWT access token.
    
    Raises:
        jwt.ExpiredSignatureError: If the token has expired.
        jwt.InvalidTokenError: If the token signature is invalid or malformed.
    """
    return jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
        options={"require": ["sub", "exp", "iat"]},
    )
