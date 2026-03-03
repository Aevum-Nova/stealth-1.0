from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.middleware.auth import get_current_org
from src.services.event_bus import EventBus, get_event_bus


DBSessionDep = AsyncSession


async def get_org_id(org_id: str = Depends(get_current_org)) -> str:
    return org_id


async def get_bus(bus: EventBus = Depends(get_event_bus)) -> EventBus:
    return bus


__all__ = ["get_db", "get_org_id", "get_bus", "DBSessionDep"]
