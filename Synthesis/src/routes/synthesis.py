from __future__ import annotations

import asyncio
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import async_session, get_db
from src.jobs.manager import ConflictError, job_manager
from src.middleware.auth import get_current_org
from src.models.feature_request import SynthesisRun
from src.models.signal import Signal
from src.schemas.common import ApiResponse
from src.schemas.job import SynthesisRunRead
from src.synthesis.engine import synthesis_engine

router = APIRouter(prefix="/api/v1/synthesis", tags=["synthesis"])


async def _execute_synthesis(org_id: str, run_id: str, mode: str) -> None:
    async with async_session() as db:
        result = await db.execute(select(SynthesisRun).where(SynthesisRun.id == UUID(run_id)))
        run = result.scalar_one_or_none()
        if not run:
            return

        async def _runner() -> None:
            await synthesis_engine.run(db, org_id, run, mode=mode)

        await job_manager.run_synthesis(org_id, run_id, _runner())


@router.post("/run", response_model=ApiResponse[dict])
async def run_synthesis(
    mode: str = Query(default="incremental"),
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    if mode not in {"incremental", "full"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="mode must be incremental or full")

    if job_manager.is_synthesis_running(org_id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Synthesis already running")

    org_uuid = UUID(org_id)
    eligible_filters = [
        Signal.organization_id == org_uuid,
        Signal.status == "completed",
    ]
    if mode != "full":
        eligible_filters.append(Signal.synthesized.is_(False))

    eligible_result = await db.execute(select(func.count()).select_from(Signal).where(*eligible_filters))
    eligible_count = int(eligible_result.scalar_one() or 0)
    if eligible_count < 2:
        inflight_result = await db.execute(
            select(func.count()).select_from(Signal).where(
                Signal.organization_id == org_uuid,
                Signal.status.in_(["pending", "processing"]),
            )
        )
        inflight_count = int(inflight_result.scalar_one() or 0)
        if inflight_count > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Not enough completed signals yet ({eligible_count} ready, {inflight_count} still processing). "
                    "Try again in a moment."
                ),
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Need at least 2 completed signals to run synthesis (currently {eligible_count}).",
        )

    run = await synthesis_engine.start_run(db, org_id, mode=mode)

    async def _bg() -> None:
        try:
            await _execute_synthesis(org_id, str(run.id), mode)
        except ConflictError:
            return

    asyncio.create_task(_bg())
    return ApiResponse(data={"run_id": str(run.id), "status": run.status})


@router.get("/runs", response_model=ApiResponse[list[SynthesisRunRead]])
async def list_runs(org_id: str = Depends(get_current_org), db: AsyncSession = Depends(get_db)):
    rows = await db.execute(
        select(SynthesisRun)
        .where(SynthesisRun.organization_id == UUID(org_id))
        .order_by(SynthesisRun.created_at.desc())
        .limit(100)
    )
    runs = list(rows.scalars().all())
    return ApiResponse(data=[SynthesisRunRead.model_validate(r) for r in runs])


@router.get("/runs/{run_id}", response_model=ApiResponse[SynthesisRunRead])
async def get_run(run_id: UUID, org_id: str = Depends(get_current_org), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SynthesisRun).where(SynthesisRun.id == run_id, SynthesisRun.organization_id == UUID(org_id))
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return ApiResponse(data=SynthesisRunRead.model_validate(run))
