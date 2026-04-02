from src.routes.auth import router as auth_router
from src.routes.chat import router as chat_router
from src.routes.connectors import router as connectors_router
from src.routes.dashboard import router as dashboard_router
from src.routes.events import router as events_router
from src.routes.feature_requests import router as feature_requests_router
from src.routes.ingest import router as ingest_router
from src.routes.jobs import router as jobs_router
from src.routes.signals import router as signals_router
from src.routes.synthesis import router as synthesis_router
from src.routes.triggers import router as triggers_router

__all__ = [
    "auth_router",
    "chat_router",
    "connectors_router",
    "dashboard_router",
    "events_router",
    "feature_requests_router",
    "ingest_router",
    "jobs_router",
    "signals_router",
    "synthesis_router",
    "triggers_router",
]
