from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.connectors.base import ConnectorConfig
from src.connectors.catalog import CONNECTOR_CATALOG
from src.connectors.figma import FigmaConnector
from src.connectors.google_forms import GoogleFormsConnector
from src.connectors.granola import GranolaConnector
from src.connectors.intercom import IntercomConnector
from src.connectors.servicenow import ServiceNowConnector
from src.connectors.slack import SlackConnector
from src.connectors.zendesk import ZendeskConnector
from src.config import settings
from src.database import get_db
from src.middleware.auth import get_current_org
from src.models.connector import Connector
from src.schemas.common import ApiResponse
from src.schemas.connector import ConnectorCreate, ConnectorRead, ConnectorUpdate
from src.services.event_bus import get_event_bus

router = APIRouter(prefix="/api/v1/connectors", tags=["connectors"])

CONNECTOR_IMPL = {
    "slack": SlackConnector,
    "google_forms": GoogleFormsConnector,
    "zendesk": ZendeskConnector,
    "servicenow": ServiceNowConnector,
    "figma": FigmaConnector,
    "granola": GranolaConnector,
    "intercom": IntercomConnector,
}

CONNECTOR_CATALOG_BY_TYPE = {item["type"]: item for item in CONNECTOR_CATALOG}
CONNECTOR_REQUIRED_ENV_VARS = {
    "slack": ("SLACK_CLIENT_ID", "SLACK_CLIENT_SECRET"),
    "google_forms": ("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"),
    "zendesk": ("ZENDESK_CLIENT_ID", "ZENDESK_CLIENT_SECRET"),
    "figma": ("FIGMA_CLIENT_ID", "FIGMA_CLIENT_SECRET"),
    "intercom": ("INTERCOM_CLIENT_ID", "INTERCOM_CLIENT_SECRET"),
    "servicenow": ("SERVICENOW_CLIENT_ID", "SERVICENOW_CLIENT_SECRET"),
}


def _missing_required_env_vars(connector_type: str) -> list[str]:
    required = CONNECTOR_REQUIRED_ENV_VARS.get(connector_type, ())
    missing = [name for name in required if not str(getattr(settings, name, "") or "").strip()]
    return missing


def _ensure_connector_type_supported(connector_type: str) -> dict:
    item = CONNECTOR_CATALOG_BY_TYPE.get(connector_type)
    if not item:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported connector type: {connector_type}")
    return item


def _ensure_connector_available(connector_type: str) -> dict:
    item = _ensure_connector_type_supported(connector_type)
    missing = _missing_required_env_vars(connector_type)
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Connector '{connector_type}' is not configured on the server. "
                f"Missing env vars: {', '.join(missing)}"
            ),
        )
    return item


def _build_connector(connector: Connector):
    impl = CONNECTOR_IMPL.get(connector.type)
    if impl is None:
        return None
    return impl(
        ConnectorConfig(
            id=str(connector.id),
            organization_id=str(connector.organization_id),
            type=connector.type,
            credentials=connector.credentials or {},
            config=connector.config or {},
        )
    )


@router.get("", response_model=ApiResponse[list[ConnectorRead]])
async def list_connectors(org_id: str = Depends(get_current_org), db: AsyncSession = Depends(get_db)):
    rows = await db.execute(
        select(Connector)
        .where(Connector.organization_id == UUID(org_id))
        .order_by(Connector.created_at.desc())
    )
    return ApiResponse(data=[ConnectorRead.model_validate(c) for c in rows.scalars().all()])


@router.post("", response_model=ApiResponse[ConnectorRead])
async def create_connector(
    payload: ConnectorCreate,
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    catalog_item = _ensure_connector_available(payload.type)

    existing_result = await db.execute(
        select(Connector)
        .where(
            Connector.organization_id == UUID(org_id),
            Connector.type == payload.type,
        )
        .order_by(Connector.updated_at.desc(), Connector.created_at.desc())
        .limit(1)
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        return ApiResponse(data=ConnectorRead.model_validate(existing))

    initial_enabled = payload.enabled
    if catalog_item.get("auth_method") == "oauth2" and not payload.credentials:
        initial_enabled = False

    connector = Connector(
        organization_id=UUID(org_id),
        type=payload.type,
        name=payload.name,
        enabled=initial_enabled,
        auto_synthesize=payload.auto_synthesize,
        config=payload.config,
        credentials=payload.credentials,
    )
    db.add(connector)
    await db.commit()
    await db.refresh(connector)
    return ApiResponse(data=ConnectorRead.model_validate(connector))


@router.get("/catalog", response_model=ApiResponse[list[dict]])
async def connector_catalog():
    items: list[dict] = []
    for item in CONNECTOR_CATALOG:
        missing = _missing_required_env_vars(item["type"])
        items.append(
            {
                **item,
                "available": len(missing) == 0,
                "missing_env_vars": missing,
            }
        )
    return ApiResponse(data=items)


@router.get("/{connector_id}", response_model=ApiResponse[ConnectorRead])
async def get_connector(
    connector_id: UUID,
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Connector).where(Connector.id == connector_id, Connector.organization_id == UUID(org_id))
    )
    connector = result.scalar_one_or_none()
    if not connector:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connector not found")
    return ApiResponse(data=ConnectorRead.model_validate(connector))


@router.patch("/{connector_id}", response_model=ApiResponse[ConnectorRead])
async def patch_connector(
    connector_id: UUID,
    payload: ConnectorUpdate,
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Connector).where(Connector.id == connector_id, Connector.organization_id == UUID(org_id))
    )
    connector = result.scalar_one_or_none()
    if not connector:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connector not found")

    catalog_item = _ensure_connector_type_supported(connector.type)
    updates = payload.model_dump(exclude_none=True)
    next_credentials = updates.get("credentials", connector.credentials or {})
    if catalog_item.get("auth_method") == "oauth2" and updates.get("enabled") is True and not next_credentials:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Connector '{connector.type}' must be authorized before it can be enabled.",
        )

    for field, value in updates.items():
        setattr(connector, field, value)

    await db.commit()
    await db.refresh(connector)
    return ApiResponse(data=ConnectorRead.model_validate(connector))


@router.delete("/{connector_id}", response_model=ApiResponse[dict])
async def delete_connector(
    connector_id: UUID,
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Connector).where(Connector.id == connector_id, Connector.organization_id == UUID(org_id))
    )
    connector = result.scalar_one_or_none()
    if not connector:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connector not found")

    await db.execute(delete(Connector).where(Connector.id == connector_id, Connector.organization_id == UUID(org_id)))
    await db.commit()
    return ApiResponse(data={"deleted": True})


@router.post("/{connector_id}/sync", response_model=ApiResponse[dict])
async def sync_connector(
    connector_id: UUID,
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Connector).where(Connector.id == connector_id, Connector.organization_id == UUID(org_id))
    )
    connector = result.scalar_one_or_none()
    if not connector:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connector not found")

    await get_event_bus().publish(
        org_id,
        "connector_sync_started",
        {"connector_id": str(connector.id), "connector_type": connector.type},
    )

    connector.last_sync_at = datetime.now(timezone.utc)
    connector.last_sync_error = None
    await db.commit()

    await get_event_bus().publish(
        org_id,
        "connector_sync_completed",
        {"connector_id": str(connector.id), "new_signals": 0, "failed": 0},
    )

    return ApiResponse(data={"connector_id": str(connector.id), "status": "completed", "new_signals": 0})


@router.get("/{connector_id}/auth-url", response_model=ApiResponse[dict])
async def connector_auth_url(
    connector_id: UUID,
    redirect_uri: str = Query(...),
    state: str = Query(...),
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Connector).where(Connector.id == connector_id, Connector.organization_id == UUID(org_id))
    )
    connector = result.scalar_one_or_none()
    if not connector:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connector not found")

    _ensure_connector_available(connector.type)
    impl = _build_connector(connector)
    auth_url = impl.get_auth_url(redirect_uri, state) if impl else None
    if not auth_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Connector '{connector.type}' OAuth is not available yet. "
                "No authorization URL could be generated."
            ),
        )
    return ApiResponse(data={"auth_url": auth_url})


@router.post("/{connector_id}/oauth-callback", response_model=ApiResponse[dict])
async def connector_oauth_callback(
    connector_id: UUID,
    code: str = Query(...),
    redirect_uri: str = Query(...),
    org_id: str = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Connector).where(Connector.id == connector_id, Connector.organization_id == UUID(org_id))
    )
    connector = result.scalar_one_or_none()
    if not connector:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connector not found")

    _ensure_connector_available(connector.type)
    impl = _build_connector(connector)
    payload = await impl.handle_oauth_callback(code, redirect_uri) if impl else {}
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Connector '{connector.type}' OAuth callback did not return credentials.",
        )
    connector.credentials = payload
    connector.enabled = True
    await db.commit()

    return ApiResponse(data={"connector_id": str(connector.id), "connected": True})
