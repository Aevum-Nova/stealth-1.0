import hashlib
import uuid
from datetime import datetime, timedelta, timezone

import httpx
import jwt
from passlib.context import CryptContext

from src.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
GOOGLE_TOKEN_INFO_URL = "https://oauth2.googleapis.com/tokeninfo"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: str, organization_id: str, role: str) -> str:
    payload = {
        "type": "access",
        "user_id": user_id,
        "organization_id": organization_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def create_refresh_token(user_id: str, token_family: str | None = None) -> tuple[str, str, datetime, str]:
    family = token_family or str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    payload = {
        "type": "refresh",
        "user_id": user_id,
        "family": family,
        "exp": expires_at,
        "iat": datetime.now(timezone.utc),
        "jti": str(uuid.uuid4()),
    }
    raw_token = jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    return raw_token, token_hash, expires_at, family


def decode_refresh_token(token: str) -> dict:
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    if payload.get("type") != "refresh":
        raise jwt.InvalidTokenError("Not a refresh token")
    return payload


async def verify_google_id_token(id_token: str) -> dict[str, str]:
    if not settings.GOOGLE_CLIENT_ID:
        raise ValueError("Google sign-in is not configured")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(GOOGLE_TOKEN_INFO_URL, params={"id_token": id_token})
    except httpx.HTTPError as exc:
        raise ValueError("Unable to verify Google token") from exc

    if response.status_code != 200:
        raise ValueError("Invalid Google token")

    payload = response.json()
    if payload.get("aud") != settings.GOOGLE_CLIENT_ID:
        raise ValueError("Google token audience mismatch")

    issuer = str(payload.get("iss", ""))
    if issuer not in {"https://accounts.google.com", "accounts.google.com"}:
        raise ValueError("Invalid Google token issuer")

    email = str(payload.get("email", "")).strip().lower()
    if not email:
        raise ValueError("Google token missing email")

    if str(payload.get("email_verified", "")).lower() != "true":
        raise ValueError("Google account email is not verified")

    try:
        expires_at = int(payload.get("exp", "0"))
    except (TypeError, ValueError) as exc:
        raise ValueError("Google token expiry is invalid") from exc

    now = int(datetime.now(timezone.utc).timestamp())
    if expires_at <= now:
        raise ValueError("Google token is expired")

    raw_name = str(payload.get("name", "")).strip()
    fallback_name = email.split("@")[0] if "@" in email else "User"
    return {"email": email, "name": raw_name or fallback_name}
