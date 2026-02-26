from __future__ import annotations

from datetime import datetime
from uuid import UUID

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, delete, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.middleware.auth import get_current_org
from src.models.signal import Signal
from src.schemas.common import ApiResponse, PaginatedResponse, Pagination
from src.schemas.signal import SignalRead
from src.services.embeddings import embedding_service
from src.services.r2 import r2_service

router = APIRouter(prefix="/api/v1/signals", tags=["signals"])


@router.get("", response_model=PaginatedResponse[SignalRead])
async def list_signals(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    source: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    sentiment: str | None = None,
    urgency: str | None = None,
    synthesized: bool | None = None,
    since: datetime | None = None,
    sort: str = "created_at",
    order: str = "desc",
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    filters = [Signal.organization_id == UUID(org_id)]
    if source:
        filters.append(Signal.source == source)
    if status_filter:
        filters.append(Signal.status == status_filter)
    if sentiment:
        filters.append(Signal.sentiment == sentiment)
    if urgency:
        filters.append(Signal.urgency == urgency)
    if synthesized is not None:
        filters.append(Signal.synthesized.is_(synthesized))
    if since:
        filters.append(Signal.created_at >= since)

    sort_column = getattr(Signal, sort, Signal.created_at)
    ordering = desc(sort_column) if order.lower() == "desc" else sort_column

    total_result = await db.execute(select(func.count()).select_from(Signal).where(and_(*filters)))
    total = int(total_result.scalar_one())

    query = (
        select(Signal)
        .where(and_(*filters))
        .order_by(ordering)
        .offset((page - 1) * limit)
        .limit(limit)
    )
    rows = await db.execute(query)
    signals = list(rows.scalars().all())

    return PaginatedResponse(
        data=[SignalRead.model_validate(s) for s in signals],
        pagination=Pagination(page=page, limit=limit, total=total),
    )


@router.get("/search", response_model=ApiResponse[list[dict]])
async def search_signals(
    q: str,
    limit: int = Query(default=10, ge=1, le=50),
    threshold: float = Query(default=0.7, ge=0.0, le=1.0),
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    query_embedding = np.array(await embedding_service.embed(q), dtype=np.float32)
    query_norm = np.linalg.norm(query_embedding) or 1.0

    rows = await db.execute(
        select(Signal).where(
            Signal.organization_id == UUID(org_id),
            Signal.status == "completed",
            Signal.embedding.is_not(None),
        )
    )
    signals = list(rows.scalars().all())

    scored: list[tuple[float, Signal]] = []
    for signal in signals:
        emb = np.array(signal.embedding, dtype=np.float32)
        score = float(np.dot(query_embedding, emb) / ((np.linalg.norm(emb) or 1.0) * query_norm))
        if score >= threshold:
            scored.append((score, signal))

    scored.sort(key=lambda x: x[0], reverse=True)
    payload = [
        {
            "signal": SignalRead.model_validate(signal).model_dump(mode="json"),
            "score": score,
        }
        for score, signal in scored[:limit]
    ]
    return ApiResponse(data=payload)


@router.get("/{signal_id}", response_model=ApiResponse[SignalRead])
async def get_signal(signal_id: UUID, org_id: str = Depends(get_current_org), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Signal).where(Signal.id == signal_id, Signal.organization_id == UUID(org_id))
    )
    signal = result.scalar_one_or_none()
    if not signal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signal not found")
    return ApiResponse(data=SignalRead.model_validate(signal))


@router.delete("/{signal_id}", response_model=ApiResponse[dict])
async def delete_signal(
    signal_id: UUID,
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Signal).where(Signal.id == signal_id, Signal.organization_id == UUID(org_id))
    )
    signal = result.scalar_one_or_none()
    if not signal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signal not found")

    await r2_service.delete(signal.raw_artifact_r2_key)
    await db.execute(delete(Signal).where(Signal.id == signal_id, Signal.organization_id == UUID(org_id)))
    await db.commit()
    return ApiResponse(data={"deleted": True})
