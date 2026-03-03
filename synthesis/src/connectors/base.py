from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class ConnectorConfig:
    id: str
    organization_id: str
    type: str
    credentials: dict
    config: dict


@dataclass
class RawIngestionItem:
    external_id: str
    data_type: str
    content: bytes | str
    mime_type: str
    metadata: dict = field(default_factory=dict)


class BaseConnector(ABC):
    def __init__(self, config: ConnectorConfig):
        self.config = config

    @abstractmethod
    async def fetch_new_data(self, since: datetime | None = None) -> list[RawIngestionItem]:
        ...

    @abstractmethod
    async def validate_credentials(self) -> bool:
        ...

    @abstractmethod
    def get_auth_url(self, redirect_uri: str, state: str) -> str | None:
        ...

    @abstractmethod
    async def handle_oauth_callback(self, code: str, redirect_uri: str) -> dict:
        ...
