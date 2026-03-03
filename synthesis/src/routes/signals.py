from __future__ import annotations

import re
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


def _normalize_query(query: str) -> str:
    return " ".join(query.lower().split())


def _query_terms(query: str) -> list[str]:
    return [term for term in re.split(r"[^a-z0-9]+", query) if len(term) >= 3]


def _search_blob(signal: Signal) -> str:
    parts = [
        signal.structured_summary,
        signal.original_text,
        signal.transcript,
        signal.extracted_text,
    ]
    return " ".join(str(part or "") for part in parts).lower()


def _keyword_score(signal: Signal, normalized_query: str, terms: list[str]) -> float:
    blob = _search_blob(signal)
    if not blob:
        return 0.0

    if normalized_query and normalized_query in blob:
        return 1.0

    if not terms:
        return 0.0

    matched = sum(1 for term in terms if term in blob)
    if matched == 0:
        return 0.0
    return matched / len(terms)


def _semantic_score(signal: Signal, query_embedding: np.ndarray, query_norm: float) -> float:
    if signal.embedding is None:
        return 0.0

    emb = np.array(signal.embedding, dtype=np.float32)
    if emb.size == 0:
        return 0.0

    emb_norm = float(np.linalg.norm(emb) or 1.0)
    return float(np.dot(query_embedding, emb) / (emb_norm * query_norm))


def _rank_signals(
    signals: list[Signal],
    query_embedding: np.ndarray,
    *,
    normalized_query: str,
    threshold: float,
) -> list[tuple[float, Signal]]:
    query_norm = float(np.linalg.norm(query_embedding) or 1.0)
    terms = _query_terms(normalized_query)

    scored: list[tuple[float, Signal]] = []
    for signal in signals:
        semantic_score = _semantic_score(signal, query_embedding, query_norm)
        keyword_score = _keyword_score(signal, normalized_query, terms)
        score = max(semantic_score, keyword_score)
        if score >= threshold:
            scored.append((score, signal))

    scored.sort(key=lambda item: item[0], reverse=True)
    return scored


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
    normalized_query = _normalize_query(q)
    query_embedding = np.array(await embedding_service.embed(normalized_query), dtype=np.float32)

    rows = await db.execute(
        select(Signal).where(
            Signal.organization_id == UUID(org_id),
            Signal.status == "completed",
        )
    )
    signals = list(rows.scalars().all())

    scored = _rank_signals(
        signals,
        query_embedding,
        normalized_query=normalized_query,
        threshold=threshold,
    )
    payload = [
        {
            "signal": SignalRead.model_validate(signal).model_dump(mode="json"),
            "score": score,
        }
        for score, signal in scored[:limit]
    ]
    return ApiResponse(data=payload)


@router.get("/{signal_id}", response_model=ApiResponse[SignalRead])
async def get_signal(
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
    await db.execute(
        delete(Signal).where(Signal.id == signal_id, Signal.organization_id == UUID(org_id))
    )
    await db.commit()
    return ApiResponse(data={"deleted": True})
