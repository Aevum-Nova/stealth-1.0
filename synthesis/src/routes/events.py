from __future__ import annotations

import asyncio
import hashlib
import json
from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.database import get_db
from src.models.api_key import ApiKey
from src.services.event_bus import get_event_bus

router = APIRouter(prefix="/api/v1/events", tags=["events"])
stream_security = HTTPBearer(auto_error=False)


async def get_stream_org(
    access_token: str | None = Query(default=None),
    credentials: Annotated[HTTPAuthorizationCredentials | None, Security(stream_security)] = None,
    db: AsyncSession = Depends(get_db),
) -> str:
    token = access_token or (credentials.credentials if credentials else None)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        if payload.get("type") == "access":
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


@router.get("/stream")
async def event_stream(org_id: str = Depends(get_stream_org)):
    bus = get_event_bus()
    queue = bus.subscribe(org_id)

    async def generate():
        try:
            while True:
                event = await queue.get()
                yield f"event: {event['event']}\ndata: {json.dumps(event['data'])}\n\n"
        except asyncio.CancelledError:
            bus.unsubscribe(org_id, queue)
            return

    return StreamingResponse(generate(), media_type="text/event-stream")
