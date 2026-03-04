"""Orchestration routes: trigger jobs, get status, list jobs."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from stealth_agent.adapters.llm import create_llm_provider
from stealth_agent.config import settings
from stealth_agent.database import get_db
from stealth_agent.middleware.auth import get_current_org
from stealth_agent.schemas import ApiResponse, JobOut, TriggerRequest
from stealth_agent.services import jobs as jobs_service

router = APIRouter(prefix="/api/v1", tags=["orchestration"])


@router.post("/feature-requests/{feature_request_id}/trigger", response_model=ApiResponse)
async def trigger_orchestration(
    feature_request_id: str,
    payload: TriggerRequest,
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    job = await jobs_service.create_job(db, feature_request_id, org_id)
    llm = create_llm_provider(settings.LLM_PROVIDER, settings.ANTHROPIC_API_KEY, settings.OPENAI_API_KEY)

    jobs_service.trigger_orchestration(
        job_id=str(job.id),
        feature_request_id=feature_request_id,
        organization_id=org_id,
        dry_run=payload.dry_run,
        llm=llm,
    )

    return ApiResponse(
        data=JobOut(
            id=str(job.id),
            feature_request_id=str(job.feature_request_id),
            status=job.status,
            result=job.result,
            error=job.error,
            created_at=job.created_at,
            updated_at=job.updated_at,
        )
    )


@router.get("/jobs/{job_id}", response_model=ApiResponse)
async def get_job(
    job_id: str,
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    job = await jobs_service.get_job(db, job_id)
    if not job or str(job.organization_id) != org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    return ApiResponse(
        data=JobOut(
            id=str(job.id),
            feature_request_id=str(job.feature_request_id),
            status=job.status,
            result=job.result,
            error=job.error,
            created_at=job.created_at,
            updated_at=job.updated_at,
        )
    )


@router.get("/feature-requests/{feature_request_id}/jobs", response_model=ApiResponse)
async def list_jobs(
    feature_request_id: str,
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    jobs = await jobs_service.list_jobs_for_feature_request(db, feature_request_id, org_id)

    return ApiResponse(
        data=[
            JobOut(
                id=str(j.id),
                feature_request_id=str(j.feature_request_id),
                status=j.status,
                result=j.result,
                error=j.error,
                created_at=j.created_at,
                updated_at=j.updated_at,
            )
            for j in jobs
        ]
    )
