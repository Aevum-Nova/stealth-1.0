"""Codebase indexing routes: trigger index, get status."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException, status

from stealth_agent.middleware.auth import get_current_org
from stealth_agent.schemas import ApiResponse
from stealth_agent.services import code_indexer

router = APIRouter(prefix="/api/v1/connectors", tags=["indexing"])


@router.post("/{connector_id}/index", response_model=ApiResponse)
async def trigger_index(
    connector_id: str,
    org_id: str = Depends(get_current_org),
):
    existing = await code_indexer.get_index_status(connector_id, org_id)
    if existing and existing["status"] == "indexing":
        return ApiResponse(data=existing)

    asyncio.get_event_loop().create_task(
        code_indexer.index_repository(connector_id, org_id)
    )

    return ApiResponse(data={
        "connector_id": connector_id,
        "status": "pending",
        "message": "Indexing started",
    })


@router.get("/{connector_id}/index/status", response_model=ApiResponse)
async def get_index_status(
    connector_id: str,
    org_id: str = Depends(get_current_org),
):
    result = await code_indexer.get_index_status(connector_id, org_id)
    if result is None:
        return ApiResponse(data={
            "connector_id": connector_id,
            "status": "not_started",
            "total_files": 0,
            "indexed_files": 0,
        })
    return ApiResponse(data=result)
