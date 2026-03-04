"""JWT validation using the shared secret with synthesis."""

from __future__ import annotations

from typing import Annotated

import jwt
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from stealth_agent.config import settings

security = HTTPBearer(auto_error=True)


async def get_current_org(
    credentials: Annotated[HTTPAuthorizationCredentials, Security(security)],
) -> str:
    """Validate JWT and return organization_id."""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        if payload.get("type") != "access":
            raise jwt.InvalidTokenError("Not an access token")
        return str(payload["organization_id"])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, KeyError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc
