from datetime import datetime, timedelta, timezone

import pytest

from src.services.auth import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    verify_google_id_token,
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


@pytest.mark.asyncio
async def test_verify_google_id_token_success(monkeypatch):
    now = datetime.now(timezone.utc)
    future = int((now + timedelta(minutes=10)).timestamp())

    class _Response:
        status_code = 200

        @staticmethod
        def json():
            return {
                "aud": "google-client-id",
                "iss": "https://accounts.google.com",
                "email": "test.user@example.com",
                "email_verified": "true",
                "exp": str(future),
                "name": "Test User",
            }

    class _FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def get(self, url: str, params: dict):
            assert "tokeninfo" in url
            assert params["id_token"] == "google-id-token"
            return _Response()

    monkeypatch.setattr("src.services.auth.settings.GOOGLE_CLIENT_ID", "google-client-id")
    monkeypatch.setattr("src.services.auth.httpx.AsyncClient", lambda timeout: _FakeClient())

    payload = await verify_google_id_token("google-id-token")

    assert payload == {"email": "test.user@example.com", "name": "Test User"}


@pytest.mark.asyncio
async def test_verify_google_id_token_rejects_audience_mismatch(monkeypatch):
    now = datetime.now(timezone.utc)
    future = int((now + timedelta(minutes=10)).timestamp())

    class _Response:
        status_code = 200

        @staticmethod
        def json():
            return {
                "aud": "some-other-client",
                "iss": "https://accounts.google.com",
                "email": "test.user@example.com",
                "email_verified": "true",
                "exp": str(future),
                "name": "Test User",
            }

    class _FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def get(self, url: str, params: dict):
            return _Response()

    monkeypatch.setattr("src.services.auth.settings.GOOGLE_CLIENT_ID", "google-client-id")
    monkeypatch.setattr("src.services.auth.httpx.AsyncClient", lambda timeout: _FakeClient())

    with pytest.raises(ValueError, match="audience mismatch"):
        await verify_google_id_token("google-id-token")
