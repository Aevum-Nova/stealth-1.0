from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.middleware.auth import get_current_org, get_current_user
from src.models.connector import Connector
from src.schemas.common import ApiResponse
from src.schemas.trigger import (
    TriggerConnectorOption,
    TriggerCreate,
    TriggerDetail,
    TriggerRead,
    TriggerUpdate,
)
from src.services.triggers import trigger_service

router = APIRouter(prefix="/api/v1/triggers", tags=["triggers"])


def _callback_url(request: Request, plugin_type: str) -> str:
    return str(request.base_url).rstrip("/") + f"/api/v1/triggers/webhooks/{plugin_type}"


@router.get("/config", response_model=ApiResponse[list[TriggerConnectorOption]])
async def trigger_config(
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    options = await trigger_service.list_connector_options(db, org_id)
    return ApiResponse(data=options)


@router.get("", response_model=ApiResponse[list[TriggerRead]])
async def list_triggers(
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await trigger_service.list_triggers(db, org_id))


@router.post("", response_model=ApiResponse[TriggerRead])
async def create_trigger(
    payload: TriggerCreate,
    request: Request,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    connector_row = await db.execute(
        select(Connector).where(
            Connector.id == payload.connector_id,
            Connector.organization_id == user.organization_id,
        )
    )
    connector = connector_row.scalar_one_or_none()
    if connector is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connector not found")
    try:
        trigger = await trigger_service.create_trigger(
            db,
            org_id=str(user.organization_id),
            user_id=str(user.id),
            connector_id=payload.connector_id,
            natural_language_description=payload.natural_language_description,
            scope=payload.scope,
            buffer_config=payload.buffer_config.model_dump(),
            match_config=payload.match_config.model_dump(),
            status=payload.status,
            callback_url=_callback_url(request, connector.type),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return ApiResponse(data=trigger)


@router.get("/{trigger_id}", response_model=ApiResponse[TriggerDetail])
async def get_trigger(
    trigger_id: UUID,
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    detail = await trigger_service.get_trigger_detail(db, org_id, trigger_id)
    if not detail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trigger not found")
    return ApiResponse(data=detail)


@router.patch("/{trigger_id}", response_model=ApiResponse[TriggerRead])
async def update_trigger(
    trigger_id: UUID,
    payload: TriggerUpdate,
    request: Request,
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    try:
        existing = await trigger_service.get_trigger_detail(db, org_id, trigger_id)
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trigger not found")
        trigger = await trigger_service.update_trigger(
            db,
            org_id=org_id,
            trigger_id=trigger_id,
            natural_language_description=payload.natural_language_description,
            scope=payload.scope,
            buffer_config=payload.buffer_config.model_dump() if payload.buffer_config else None,
            match_config=payload.match_config.model_dump() if payload.match_config else None,
            status=payload.status,
            callback_url=_callback_url(request, existing.trigger.plugin_type),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if not trigger:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trigger not found")
    return ApiResponse(data=trigger)


@router.delete("/{trigger_id}", response_model=ApiResponse[dict])
async def delete_trigger(
    trigger_id: UUID,
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    deleted = await trigger_service.delete_trigger(db, org_id, trigger_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trigger not found")
    return ApiResponse(data={"deleted": True})


@router.post("/{trigger_id}/pause", response_model=ApiResponse[TriggerRead])
async def pause_trigger(
    trigger_id: UUID,
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    trigger = await trigger_service.set_trigger_status(db, org_id, trigger_id, "paused")
    if not trigger:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trigger not found")
    return ApiResponse(data=trigger)


@router.post("/{trigger_id}/resume", response_model=ApiResponse[TriggerRead])
async def resume_trigger(
    trigger_id: UUID,
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    trigger = await trigger_service.set_trigger_status(db, org_id, trigger_id, "active")
    if not trigger:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trigger not found")
    return ApiResponse(data=trigger)


@router.post("/dispatch-due", response_model=ApiResponse[dict])
async def dispatch_due_buffers(org_id: str = Depends(get_current_org)):
    processed = await trigger_service.run_due_buffers_once(org_id=org_id)
    return ApiResponse(data={"processed": processed})


@router.post("/webhooks/{plugin_type}")
async def receive_webhook(
    plugin_type: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    validation_token: str | None = Query(default=None, alias="validationToken"),
):
    if validation_token:
        return PlainTextResponse(content=validation_token)

    payload = await request.json()
    if plugin_type == "slack" and payload.get("type") == "url_verification":
        return {"challenge": payload.get("challenge")}

    try:
        result = await trigger_service.process_webhook(
            db,
            plugin_type=plugin_type,
            payload=payload,
            headers={key.lower(): value for key, value in request.headers.items()},
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {"ok": True, **result}
