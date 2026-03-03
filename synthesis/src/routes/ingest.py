from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import async_session, get_db
from src.jobs.manager import job_manager
from src.middleware.auth import get_current_org
from src.models.job import IngestionJob
from src.schemas.job import BatchUploadRejectedItem, BatchUploadResponse
from src.schemas.signal import IngestTextBatchRequest, IngestTextRequest
from src.schemas.common import ApiResponse
from src.services.event_bus import get_event_bus
from src.services.signal_builder import signal_builder

router = APIRouter(prefix="/api/v1/ingest", tags=["ingest"])

MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024
MAX_FILES_PER_BATCH = 50

TEXT_EXTENSIONS = {".txt", ".md", ".csv", ".json"}
AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".webm", ".ogg"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}


def _parse_metadata(raw: str | None) -> dict:
    if not raw:
        return {}
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="metadata must be valid JSON") from exc
    if not isinstance(value, dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="metadata must be a JSON object")
    return value


def _detect_data_type(filename: str, mime_type: str | None) -> str | None:
    suffix = Path(filename).suffix.lower()
    if suffix in TEXT_EXTENSIONS or (mime_type and (mime_type.startswith("text/") or mime_type == "application/json")):
        return "text"
    if suffix in AUDIO_EXTENSIONS or (mime_type and mime_type.startswith("audio/")):
        return "audio"
    if suffix in IMAGE_EXTENSIONS or (mime_type and mime_type.startswith("image/")):
        return "image"
    return None


async def _process_single_signal(signal_id: str, raw_content: bytes, job_id: str | None = None) -> None:
    async with async_session() as db:
        await signal_builder.process_signal(db, signal_id, raw_content, job_id=job_id)


async def _run_job(job_id: str, org_id: str, items: list[tuple[str, bytes]]) -> None:
    async with async_session() as db:
        result = await db.execute(select(IngestionJob).where(IngestionJob.id == UUID(job_id)))
        job = result.scalar_one_or_none()
        if not job:
            return

        job.status = "processing"
        job.started_at = datetime.now(timezone.utc)
        await db.commit()

        processed = 0
        failed = 0
        for signal_id, raw in items:
            try:
                await signal_builder.process_signal(db, signal_id, raw, job_id=job_id)
                processed += 1
            except Exception:
                failed += 1

            job.processed_items = processed
            job.failed_items = failed
            await db.commit()

        job.status = "completed" if failed == 0 else "completed_with_errors"
        job.completed_at = datetime.now(timezone.utc)
        await db.commit()

        await get_event_bus().publish(
            org_id,
            "job_completed",
            {"job_id": job_id, "processed": processed, "failed": failed, "total": len(items)},
        )


@router.post("/text", response_model=ApiResponse[dict])
async def ingest_text(payload: IngestTextRequest, org_id: str = Depends(get_current_org), db: AsyncSession = Depends(get_db)):
    raw = payload.text.encode("utf-8")
    signal = await signal_builder.create_pending_signal(
        db,
        organization_id=org_id,
        source=payload.source,
        source_data_type="text",
        raw_bytes=raw,
        mime_type="text/plain",
        filename="text.txt",
        metadata=payload.metadata,
    )

    asyncio.create_task(_process_single_signal(str(signal.id), raw))
    return ApiResponse(data={"signal_id": str(signal.id), "status": signal.status})


@router.post("/text/batch", response_model=ApiResponse[dict])
async def ingest_text_batch(
    payload: IngestTextBatchRequest,
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    if len(payload.items) > 100:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Max batch size is 100 items")

    job = IngestionJob(
        organization_id=UUID(org_id),
        status="pending",
        total_items=len(payload.items),
        processed_items=0,
        failed_items=0,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    items_to_process: list[tuple[str, bytes]] = []
    signal_ids: list[str] = []

    for item in payload.items:
        raw = item.text.encode("utf-8")
        signal = await signal_builder.create_pending_signal(
            db,
            organization_id=org_id,
            source=payload.source,
            source_data_type="text",
            raw_bytes=raw,
            mime_type="text/plain",
            filename="text.txt",
            metadata=item.metadata,
        )
        signal_ids.append(str(signal.id))
        items_to_process.append((str(signal.id), raw))

    job.signal_ids = signal_ids
    await db.commit()

    asyncio.create_task(job_manager.run_ingestion_job(str(job.id), _run_job(str(job.id), org_id, items_to_process)))
    return ApiResponse(data={"job_id": str(job.id), "total_items": len(payload.items), "accepted": len(payload.items)})


@router.post("/upload", response_model=ApiResponse[dict])
async def upload_file(
    file: UploadFile = File(...),
    source: str = Form(default="direct_upload"),
    metadata: str | None = Form(default=None),
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    if source != "direct_upload":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="source must be direct_upload")

    raw = await file.read()
    if len(raw) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File exceeds 100MB limit")

    data_type = _detect_data_type(file.filename or "upload", file.content_type)
    if not data_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Unsupported file type. Supported: txt, md, csv, json, mp3, wav, m4a, webm, "
                "ogg, png, jpg, jpeg, webp, gif"
            ),
        )

    signal = await signal_builder.create_pending_signal(
        db,
        organization_id=org_id,
        source="direct_upload",
        source_data_type=data_type,
        raw_bytes=raw,
        mime_type=file.content_type or "application/octet-stream",
        filename=file.filename or f"upload.{data_type}",
        metadata=_parse_metadata(metadata),
    )

    asyncio.create_task(_process_single_signal(str(signal.id), raw))
    return ApiResponse(data={"signal_id": str(signal.id), "status": signal.status})


@router.post("/upload/batch", response_model=ApiResponse[BatchUploadResponse])
async def upload_batch(
    files: list[UploadFile] = File(...),
    metadata: str | None = Form(default=None),
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    if len(files) > MAX_FILES_PER_BATCH:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Max 50 files per batch")

    shared_metadata = _parse_metadata(metadata)
    accepted_items: list[tuple[str, bytes]] = []
    rejected: list[BatchUploadRejectedItem] = []
    signal_ids: list[str] = []

    for upload in files:
        filename = upload.filename or "unknown"
        raw = await upload.read()

        if len(raw) > MAX_FILE_SIZE_BYTES:
            rejected.append(BatchUploadRejectedItem(filename=filename, reason="File exceeds 100MB limit"))
            continue

        data_type = _detect_data_type(filename, upload.content_type)
        if not data_type:
            rejected.append(
                BatchUploadRejectedItem(
                    filename=filename,
                    reason=(
                        "Unsupported file type. Supported: txt, md, csv, json, mp3, wav, m4a, webm, "
                        "ogg, png, jpg, jpeg, webp, gif"
                    ),
                )
            )
            continue

        signal = await signal_builder.create_pending_signal(
            db,
            organization_id=org_id,
            source="direct_upload",
            source_data_type=data_type,
            raw_bytes=raw,
            mime_type=upload.content_type or "application/octet-stream",
            filename=filename,
            metadata=shared_metadata,
        )
        signal_ids.append(str(signal.id))
        accepted_items.append((str(signal.id), raw))

    job = IngestionJob(
        organization_id=UUID(org_id),
        status="pending",
        total_items=len(accepted_items),
        processed_items=0,
        failed_items=0,
        signal_ids=signal_ids,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    if accepted_items:
        asyncio.create_task(
            job_manager.run_ingestion_job(str(job.id), _run_job(str(job.id), org_id, accepted_items))
        )

    return ApiResponse(
        data=BatchUploadResponse(
            job_id=str(job.id),
            total_files=len(files),
            accepted=len(accepted_items),
            rejected=len(rejected),
            rejected_reasons=rejected,
        )
    )
