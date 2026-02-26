from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.middleware.auth import get_current_org
from src.models.feature_request import SynthesisRun
from src.models.job import IngestionJob
from src.schemas.common import ApiResponse

router = APIRouter(prefix="/api/v1/jobs", tags=["jobs"])


@router.get("", response_model=ApiResponse[list[dict]])
async def list_jobs(org_id: str = Depends(get_current_org), db: AsyncSession = Depends(get_db)):
    org_uuid = UUID(org_id)
    ingestion_rows = await db.execute(
        select(IngestionJob)
        .where(IngestionJob.organization_id == org_uuid)
        .order_by(IngestionJob.created_at.desc())
        .limit(50)
    )
    synth_rows = await db.execute(
        select(SynthesisRun)
        .where(SynthesisRun.organization_id == org_uuid)
        .order_by(SynthesisRun.created_at.desc())
        .limit(50)
    )

    jobs = [
        {
            "id": str(job.id),
            "type": "ingestion",
            "status": job.status,
            "created_at": job.created_at,
            "started_at": job.started_at,
            "completed_at": job.completed_at,
            "total_items": job.total_items,
            "processed_items": job.processed_items,
            "failed_items": job.failed_items,
        }
        for job in ingestion_rows.scalars().all()
    ] + [
        {
            "id": str(run.id),
            "type": "synthesis",
            "status": run.status,
            "created_at": run.created_at,
            "started_at": run.started_at,
            "completed_at": run.completed_at,
            "signal_count": run.signal_count,
            "cluster_count": run.cluster_count,
            "feature_request_count": run.feature_request_count,
        }
        for run in synth_rows.scalars().all()
    ]

    jobs.sort(key=lambda x: x["created_at"], reverse=True)
    return ApiResponse(data=jobs)


@router.get("/{job_id}", response_model=ApiResponse[dict])
async def get_job(job_id: UUID, org_id: str = Depends(get_current_org), db: AsyncSession = Depends(get_db)):
    org_uuid = UUID(org_id)

    ingestion_result = await db.execute(
        select(IngestionJob).where(IngestionJob.id == job_id, IngestionJob.organization_id == org_uuid)
    )
    ingestion_job = ingestion_result.scalar_one_or_none()
    if ingestion_job:
        return ApiResponse(
            data={
                "id": str(ingestion_job.id),
                "type": "ingestion",
                "status": ingestion_job.status,
                "total_items": ingestion_job.total_items,
                "processed_items": ingestion_job.processed_items,
                "failed_items": ingestion_job.failed_items,
                "signal_ids": ingestion_job.signal_ids,
                "error": ingestion_job.error,
                "started_at": ingestion_job.started_at,
                "completed_at": ingestion_job.completed_at,
                "created_at": ingestion_job.created_at,
            }
        )

    synthesis_result = await db.execute(
        select(SynthesisRun).where(SynthesisRun.id == job_id, SynthesisRun.organization_id == org_uuid)
    )
    synthesis_run = synthesis_result.scalar_one_or_none()
    if synthesis_run:
        return ApiResponse(
            data={
                "id": str(synthesis_run.id),
                "type": "synthesis",
                "status": synthesis_run.status,
                "signal_count": synthesis_run.signal_count,
                "cluster_count": synthesis_run.cluster_count,
                "feature_request_count": synthesis_run.feature_request_count,
                "feature_request_ids": synthesis_run.feature_request_ids,
                "error": synthesis_run.error,
                "started_at": synthesis_run.started_at,
                "completed_at": synthesis_run.completed_at,
                "created_at": synthesis_run.created_at,
            }
        )

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
