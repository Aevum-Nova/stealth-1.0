from __future__ import annotations

import hashlib
from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.database import get_db
from src.models.api_key import ApiKey
from src.models.user import User

security = HTTPBearer(auto_error=True)


async def get_current_org(
    credentials: Annotated[HTTPAuthorizationCredentials, Security(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> str:
    token = credentials.credentials

    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        if payload.get("type") != "access":
            raise jwt.InvalidTokenError("Not an access token")
        return str(payload["organization_id"])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, KeyError):
        pass

    key_hash = hashlib.sha256(token.encode()).hexdigest()
    result = await db.execute(
        select(ApiKey).where(
            ApiKey.key_hash == key_hash,
            ApiKey.revoked_at.is_(None),
        )
    )
    api_key = result.scalar_one_or_none()
    if api_key:
        return str(api_key.organization_id)

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Security(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        if payload.get("type") != "access":
            raise jwt.InvalidTokenError()
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    result = await db.execute(select(User).where(User.id == UUID(str(user_id))))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def require_admin(user: Annotated[User, Depends(get_current_user)]) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
    return user
