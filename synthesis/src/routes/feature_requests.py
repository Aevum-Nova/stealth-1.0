from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, delete, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.middleware.auth import get_current_org
from src.models.feature_request import FeatureRequest, FeatureRequestSignal
from src.models.signal import Signal
from src.schemas.common import ApiResponse, PaginatedResponse, Pagination
from src.schemas.feature_request import (
    FeatureRequestImageUrl,
    FeatureRequestPatch,
    FeatureRequestRead,
    MergeFeatureRequestRequest,
)
from src.schemas.signal import SignalRead
from src.services.r2 import r2_service
from src.synthesis.prioritizer import compute_impact_metrics, compute_priority_score, priority_from_score

router = APIRouter(prefix="/api/v1/feature-requests", tags=["feature_requests"])


@router.get("", response_model=PaginatedResponse[FeatureRequestRead])
async def list_feature_requests(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    status_filter: str | None = Query(default=None, alias="status"),
    fr_type: str | None = Query(default=None, alias="type"),
    priority: str | None = None,
    min_score: int | None = None,
    signal_id: UUID | None = None,
    sort: str = "priority_score",
    order: str = "desc",
    synthesis_run_id: UUID | None = None,
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    filters = [FeatureRequest.organization_id == UUID(org_id)]
    if status_filter:
        filters.append(FeatureRequest.status == status_filter)
    if fr_type:
        filters.append(FeatureRequest.type == fr_type)
    if priority:
        filters.append(FeatureRequest.priority == priority)
    if min_score is not None:
        filters.append(FeatureRequest.priority_score >= min_score)
    if synthesis_run_id:
        filters.append(FeatureRequest.synthesis_run_id == synthesis_run_id)

    base_query = select(FeatureRequest)
    if signal_id:
        base_query = base_query.join(
            FeatureRequestSignal,
            FeatureRequestSignal.feature_request_id == FeatureRequest.id,
        ).where(FeatureRequestSignal.signal_id == signal_id)

    sort_column = getattr(FeatureRequest, sort, FeatureRequest.priority_score)
    ordering = desc(sort_column) if order.lower() == "desc" else sort_column

    total_query = select(func.count()).select_from(base_query.where(and_(*filters)).subquery())
    total_result = await db.execute(total_query)
    total = int(total_result.scalar_one())

    rows = await db.execute(
        base_query.where(and_(*filters)).order_by(ordering).offset((page - 1) * limit).limit(limit)
    )
    feature_requests = list(rows.scalars().all())

    updated = False
    for fr in feature_requests:
        try:
            edited_fields = set(fr.human_edited_fields or [])
            if "title" in edited_fields:
                continue
            title = (fr.title or "").strip()
            if title.lower().startswith("address recurring feedback from"):
                evidence = fr.supporting_evidence or []
                top_summary = ""
                if evidence:
                    top_summary = (evidence[0].get("signal_summary") or "").strip()
                if top_summary:
                    cleaned = " ".join(top_summary.split()).strip()
                    if len(cleaned) > 90:
                        cleaned = cleaned[:87].rstrip() + "..."
                    fr.title = cleaned
                    updated = True
        except Exception:
            continue

    if updated:
        await db.commit()

    return PaginatedResponse(
        data=[FeatureRequestRead.model_validate(fr) for fr in feature_requests],
        pagination=Pagination(page=page, limit=limit, total=total),
    )


@router.get("/{feature_request_id}", response_model=ApiResponse[FeatureRequestRead])
async def get_feature_request(
    feature_request_id: UUID,
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(FeatureRequest).where(
            FeatureRequest.id == feature_request_id,
            FeatureRequest.organization_id == UUID(org_id),
        )
    )
    feature_request = result.scalar_one_or_none()
    if not feature_request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feature request not found")

    # If title is still the generic fallback and has not been human-edited, replace with top signal summary.
    try:
        edited_fields = set(feature_request.human_edited_fields or [])
        if "title" not in edited_fields:
            title = (feature_request.title or "").strip()
            if title.lower().startswith("address recurring feedback from"):
                evidence = feature_request.supporting_evidence or []
                top_summary = ""
                if evidence:
                    top_summary = (evidence[0].get("signal_summary") or "").strip()
                if top_summary:
                    cleaned = " ".join(top_summary.split()).strip()
                    if len(cleaned) > 90:
                        cleaned = cleaned[:87].rstrip() + "..."
                    feature_request.title = cleaned
                    await db.commit()
    except Exception:
        # If any auto-title logic fails, fall back to returning the original row.
        pass

    return ApiResponse(data=FeatureRequestRead.model_validate(feature_request))


@router.patch("/{feature_request_id}", response_model=ApiResponse[FeatureRequestRead])
async def patch_feature_request(
    feature_request_id: UUID,
    payload: FeatureRequestPatch,
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(FeatureRequest).where(
            FeatureRequest.id == feature_request_id,
            FeatureRequest.organization_id == UUID(org_id),
        )
    )
    fr = result.scalar_one_or_none()
    if not fr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feature request not found")

    edited_fields = set(fr.human_edited_fields or [])
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(fr, field, value)
        edited_fields.add(field)

    fr.human_edited = True
    fr.human_edited_fields = sorted(edited_fields)
    await db.commit()
    await db.refresh(fr)

    return ApiResponse(data=FeatureRequestRead.model_validate(fr))


@router.delete("/{feature_request_id}", response_model=ApiResponse[dict])
async def delete_feature_request(
    feature_request_id: UUID,
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(FeatureRequest).where(
            FeatureRequest.id == feature_request_id,
            FeatureRequest.organization_id == UUID(org_id),
        )
    )
    fr = result.scalar_one_or_none()
    if not fr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feature request not found")

    await db.execute(
        delete(FeatureRequest).where(
            FeatureRequest.id == feature_request_id,
            FeatureRequest.organization_id == UUID(org_id),
        )
    )
    await db.commit()
    return ApiResponse(data={"deleted": True})


async def _set_status(feature_request_id: UUID, org_id: str, db: AsyncSession, value: str) -> ApiResponse[dict]:
    result = await db.execute(
        select(FeatureRequest).where(
            FeatureRequest.id == feature_request_id,
            FeatureRequest.organization_id == UUID(org_id),
        )
    )
    fr = result.scalar_one_or_none()
    if not fr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feature request not found")

    fr.status = value
    await db.commit()
    return ApiResponse(data={"id": str(fr.id), "status": fr.status})


@router.post("/{feature_request_id}/send-to-agent", response_model=ApiResponse[dict])
async def send_to_agent(
    feature_request_id: UUID,
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    return await _set_status(feature_request_id, org_id, db, "sent_to_agent")


@router.post("/{feature_request_id}/merge", response_model=ApiResponse[dict])
async def merge_feature_request(
    feature_request_id: UUID,
    payload: MergeFeatureRequestRequest,
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    source_result = await db.execute(
        select(FeatureRequest).where(
            FeatureRequest.id == feature_request_id,
            FeatureRequest.organization_id == UUID(org_id),
        )
    )
    source = source_result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source feature request not found")

    target_result = await db.execute(
        select(FeatureRequest).where(
            FeatureRequest.id == payload.target_id,
            FeatureRequest.organization_id == UUID(org_id),
        )
    )
    target = target_result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target feature request not found")

    source_evidence = source.supporting_evidence or []
    target_evidence = target.supporting_evidence or []
    evidence_by_signal = {item["signal_id"]: item for item in target_evidence if item.get("signal_id")}
    for item in source_evidence:
        signal_key = item.get("signal_id")
        if signal_key:
            evidence_by_signal[signal_key] = item

    source_images = source.images or []
    target_images = target.images or []
    image_by_key = {item["r2_key"]: item for item in target_images if item.get("r2_key")}
    for item in source_images:
        key = item.get("r2_key")
        if key:
            image_by_key[key] = item

    target.supporting_evidence = list(evidence_by_signal.values())
    target.images = list(image_by_key.values())

    linked_signal_ids = [str(item["signal_id"]) for item in target.supporting_evidence if item.get("signal_id")]
    if linked_signal_ids:
        signal_rows = await db.execute(
            select(Signal).where(
                Signal.organization_id == UUID(org_id),
                Signal.id.in_([UUID(sid) for sid in linked_signal_ids]),
            )
        )
        supporting_signals = list(signal_rows.scalars().all())
    else:
        supporting_signals = []

    metrics = compute_impact_metrics(linked_signal_ids, supporting_signals)
    score = compute_priority_score(metrics, (target.synthesis_confidence or 50) / 100)
    target.impact_metrics = metrics.model_dump(mode="json")
    target.priority_score = score
    target.priority = priority_from_score(score)

    source.status = "merged"
    source.merged_into_id = target.id

    await db.commit()
    return ApiResponse(data={"merged": True, "source_id": str(source.id), "target_id": str(target.id)})


@router.get("/{feature_request_id}/signals", response_model=ApiResponse[list[SignalRead]])
async def get_feature_request_signals(
    feature_request_id: UUID,
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        select(Signal)
        .join(FeatureRequestSignal, FeatureRequestSignal.signal_id == Signal.id)
        .join(FeatureRequest, FeatureRequestSignal.feature_request_id == FeatureRequest.id)
        .where(
            FeatureRequest.id == feature_request_id,
            FeatureRequest.organization_id == UUID(org_id),
            Signal.organization_id == UUID(org_id),
        )
    )
    signals = list(rows.scalars().all())
    return ApiResponse(data=[SignalRead.model_validate(s) for s in signals])


@router.get("/{feature_request_id}/images", response_model=ApiResponse[list[FeatureRequestImageUrl]])
async def get_feature_request_images(
    feature_request_id: UUID,
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(FeatureRequest).where(
            FeatureRequest.id == feature_request_id,
            FeatureRequest.organization_id == UUID(org_id),
        )
    )
    fr = result.scalar_one_or_none()
    if not fr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feature request not found")

    images = []
    for image in fr.images or []:
        images.append(
            FeatureRequestImageUrl(
                r2_key=image["r2_key"],
                url=await r2_service.get_presigned_url(image["r2_key"]),
                signal_id=UUID(str(image["signal_id"])),
                description=image.get("description", ""),
                mime_type=image.get("mime_type", "application/octet-stream"),
            )
        )

    return ApiResponse(data=images)
