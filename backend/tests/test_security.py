import pytest
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
)
import jwt


def test_password_hashing_and_verification():
    password = "SuperSecretPassword123!"
    hashed = hash_password(password)

    assert hashed.startswith("$argon2id$v=19$")
    assert verify_password(password, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False
    assert verify_password("", hashed) is False
    assert verify_password(password, "") is False


def test_empty_password_rejection():
    with pytest.raises(ValueError):
        hash_password("")


def test_jwt_creation_and_decoding():
    user_id = "test-user-uuid-1234"
    token = create_access_token(user_id)

    payload = decode_access_token(token)
    assert payload["sub"] == user_id
    assert payload["type"] == "access"
    assert "exp" in payload
    assert "iat" in payload


def test_jwt_invalid_signature():
    token = create_access_token("user-1")
    tampered_token = token[:-5] + "abcde"
    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token(tampered_token)


def test_production_security_validation():
    from app.core.config import Settings

    # Insecure secret with DEBUG=False must raise ValueError
    insecure_settings = Settings(
        DEBUG=False,
        JWT_SECRET_KEY="modelfit-insecure-dev-secret-key-change-in-production-min32chars",
    )
    with pytest.raises(ValueError, match="CRITICAL: Production deployment detected"):
        insecure_settings.validate_production_security()

    # Secure secret with DEBUG=False must succeed
    secure_settings = Settings(
        DEBUG=False,
        JWT_SECRET_KEY="a" * 64,
    )
    secure_settings.validate_production_security()
