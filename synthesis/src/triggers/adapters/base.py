from __future__ import annotations

import hashlib
import hmac
import json
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from src.models.connector import Connector


@dataclass(slots=True)
class ScopeOptionDefinition:
    label: str
    value: str
    description: str | None = None


@dataclass(slots=True)
class ScopeFieldDefinition:
    key: str
    label: str
    field_type: str = "select"
    multiple: bool = True
    required: bool = False
    help: str | None = None
    options: list[ScopeOptionDefinition] = field(default_factory=list)


@dataclass(slots=True)
class SubscriptionPlan:
    adapter_kind: str
    callback_url: str
    external_subscription_id: str | None = None
    scope_config: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)
    subscription_expiry: datetime | None = None


@dataclass(slots=True)
class NormalizedTriggerEvent:
    external_id: str
    occurred_at: datetime
    content_type: str
    content_text: str
    source_context: dict[str, Any] = field(default_factory=dict)
    author: dict[str, Any] = field(default_factory=dict)
    content_metadata: dict[str, Any] = field(default_factory=dict)
    raw_payload: dict[str, Any] = field(default_factory=dict)

    def as_payload(self, plugin_type: str) -> dict[str, Any]:
        return {
            "plugin_type": plugin_type,
            "external_id": self.external_id,
            "timestamp": self.occurred_at.isoformat(),
            "content_type": self.content_type,
            "content_text": self.content_text,
            "source_context": self.source_context,
            "author": self.author,
            "content_metadata": self.content_metadata,
            "raw_payload": self.raw_payload,
        }


class BaseTriggerAdapter(ABC):
    plugin_type: str
    display_name: str
    icon: str
    adapter_kind: str = "webhook"
    install_hint: str | None = None

    @abstractmethod
    def build_scope_fields(self, connector: Connector) -> list[ScopeFieldDefinition]:
        ...

    @abstractmethod
    def build_subscription_plan(self, connector: Connector, scope: dict[str, Any], callback_url: str) -> SubscriptionPlan:
        ...

    @abstractmethod
    def normalize_webhook_payload(self, payload: dict[str, Any], headers: dict[str, str]) -> list[NormalizedTriggerEvent]:
        ...

    def summarize_scope(self, scope: dict[str, Any], connector: Connector) -> str:
        labels: list[str] = []
        for scope_field in self.build_scope_fields(connector):
            values = scope.get(scope_field.key)
            if not values:
                continue
            value_list = values if isinstance(values, list) else [values]
            mapped = {opt.value: opt.label for opt in scope_field.options}
            rendered = ", ".join(mapped.get(str(value), str(value)) for value in value_list)
            labels.append(f"{scope_field.label}: {rendered}")
        return " • ".join(labels) if labels else "All activity"

    def verify_request(self, payload: bytes, headers: dict[str, str], shared_secret: str | None = None) -> bool:
        if not shared_secret:
            return True

        candidate = (
            headers.get("x-signature")
            or headers.get("x-hub-signature")
            or headers.get("x-slack-signature")
            or headers.get("x-zendesk-webhook-signature")
            or headers.get("figma-signature")
        )
        if not candidate:
            return False

        digest = hmac.new(shared_secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
        normalized = candidate.split("=", 1)[-1].strip()
        return hmac.compare_digest(digest, normalized)

    def scope_matches(self, scope: dict[str, Any], event: NormalizedTriggerEvent) -> bool:
        if not scope:
            return True

        for key, expected in scope.items():
            if expected in (None, ""):
                continue
            if expected == []:
                return False
            actual = event.source_context.get(key)
            expected_values = expected if isinstance(expected, list) else [expected]
            if actual not in expected_values:
                return False
        return True

    @staticmethod
    def coerce_datetime(value: Any, default: datetime | None = None) -> datetime:
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=UTC)
        if isinstance(value, (int, float)):
            return datetime.fromtimestamp(value, tz=UTC)
        if isinstance(value, str):
            cleaned = value.strip()
            if cleaned:
                try:
                    return datetime.fromisoformat(cleaned.replace("Z", "+00:00"))
                except ValueError:
                    pass
        return default or datetime.now(UTC)

    @staticmethod
    def normalize_text(value: Any) -> str:
        if value is None:
            return ""
        text = str(value)
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", text)
        return text.strip()

    @staticmethod
    def json_safe(value: Any) -> dict[str, Any]:
        if isinstance(value, dict):
            return value
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {"value": value}
        except Exception:
            return {"value": value}
