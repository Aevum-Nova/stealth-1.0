import hashlib
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from passlib.context import CryptContext

from src.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


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
