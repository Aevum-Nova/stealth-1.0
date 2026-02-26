from __future__ import annotations

import time
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.middleware.auth import get_current_org
from src.models.connector import Connector
from src.models.feature_request import FeatureRequest, SynthesisRun
from src.models.signal import Signal
from src.schemas.common import ApiResponse

router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])

_CACHE: dict[str, tuple[float, dict]] = {}
_CACHE_TTL_SECONDS = 30


@router.get("/stats", response_model=ApiResponse[dict])
async def dashboard_stats(org_id: str = Depends(get_current_org), db: AsyncSession = Depends(get_db)):
    cached = _CACHE.get(org_id)
    now = time.time()
    if cached and now - cached[0] <= _CACHE_TTL_SECONDS:
        return ApiResponse(data=cached[1])

    org_uuid = UUID(org_id)

    total_signals = await _scalar(db, select(func.count()).select_from(Signal).where(Signal.organization_id == org_uuid))
    signals_pending = await _scalar(
        db,
        select(func.count()).select_from(Signal).where(
            Signal.organization_id == org_uuid,
            Signal.status.in_(["pending", "processing"]),
        ),
    )
    signals_failed = await _scalar(
        db,
        select(func.count()).select_from(Signal).where(
            Signal.organization_id == org_uuid,
            Signal.status == "failed",
        ),
    )

    total_feature_requests = await _scalar(
        db,
        select(func.count()).select_from(FeatureRequest).where(FeatureRequest.organization_id == org_uuid),
    )

    fr_status_rows = await db.execute(
        select(FeatureRequest.status, func.count())
        .where(FeatureRequest.organization_id == org_uuid)
        .group_by(FeatureRequest.status)
    )
    fr_by_status = {status: count for status, count in fr_status_rows.all()}

    fr_priority_rows = await db.execute(
        select(FeatureRequest.priority, func.count())
        .where(FeatureRequest.organization_id == org_uuid)
        .group_by(FeatureRequest.priority)
    )
    fr_by_priority = {priority: count for priority, count in fr_priority_rows.all()}

    active_connectors = await _scalar(
        db,
        select(func.count()).select_from(Connector).where(
            Connector.organization_id == org_uuid,
            Connector.enabled.is_(True),
        ),
    )

    last_synthesis_row = await db.execute(
        select(SynthesisRun.completed_at)
        .where(SynthesisRun.organization_id == org_uuid, SynthesisRun.status == "completed")
        .order_by(SynthesisRun.completed_at.desc())
        .limit(1)
    )
    last_synthesis_at = last_synthesis_row.scalar_one_or_none()

    if last_synthesis_at:
        since_count = await _scalar(
            db,
            select(func.count()).select_from(Signal).where(
                Signal.organization_id == org_uuid,
                Signal.created_at > last_synthesis_at,
            ),
        )
    else:
        since_count = total_signals

    sources_rows = await db.execute(
        select(Signal.source, func.count())
        .where(Signal.organization_id == org_uuid)
        .group_by(Signal.source)
    )
    sources_breakdown = {source: count for source, count in sources_rows.all()}

    payload = {
        "total_signals": total_signals,
        "signals_pending": signals_pending,
        "signals_failed": signals_failed,
        "total_feature_requests": total_feature_requests,
        "feature_requests_by_status": fr_by_status,
        "feature_requests_by_priority": fr_by_priority,
        "active_connectors": active_connectors,
        "last_synthesis_at": last_synthesis_at.isoformat() if isinstance(last_synthesis_at, datetime) else None,
        "signals_since_last_synthesis": since_count,
        "sources_breakdown": sources_breakdown,
    }

    _CACHE[org_id] = (now, payload)
    return ApiResponse(data=payload)


async def _scalar(db: AsyncSession, query):
    result = await db.execute(query)
    return int(result.scalar_one() or 0)
