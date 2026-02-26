from src.services.auth import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)


def test_password_hash_and_verify():
    raw = "my-strong-password"
    hashed = hash_password(raw)
    assert hashed != raw
    assert verify_password(raw, hashed)


def test_create_access_token():
    token = create_access_token("u1", "o1", "admin")
    assert isinstance(token, str)
    assert len(token) > 20


def test_refresh_token_roundtrip():
    token, token_hash, expires_at, family = create_refresh_token("u1")
    payload = decode_refresh_token(token)

    assert payload["type"] == "refresh"
    assert payload["user_id"] == "u1"
    assert payload["family"] == family
    assert token_hash
    assert expires_at
