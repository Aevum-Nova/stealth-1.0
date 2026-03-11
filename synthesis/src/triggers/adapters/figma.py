from __future__ import annotations

from src.models.connector import Connector
from src.triggers.adapters.base import (
    BaseTriggerAdapter,
    NormalizedTriggerEvent,
    ScopeFieldDefinition,
    ScopeOptionDefinition,
    SubscriptionPlan,
)


class FigmaTriggerAdapter(BaseTriggerAdapter):
    plugin_type = "figma"
    display_name = "Figma"
    icon = "figma"
    adapter_kind = "webhook"
    install_hint = "Team-level webhooks are preferred; file-level scope works if your connector only has specific file keys."

    def build_scope_fields(self, connector: Connector) -> list[ScopeFieldDefinition]:
        file_keys = [str(value) for value in (connector.config or {}).get("file_keys", []) if str(value).strip()]
        return [
            ScopeFieldDefinition(
                key="file_key",
                label="Files",
                multiple=True,
                options=[ScopeOptionDefinition(label=value, value=value) for value in file_keys],
            )
        ]

    def build_subscription_plan(self, connector: Connector, scope: dict, callback_url: str) -> SubscriptionPlan:
        return SubscriptionPlan(
            adapter_kind=self.adapter_kind,
            callback_url=callback_url,
            external_subscription_id=f"figma-{connector.id}",
            scope_config={"file_key": scope.get("file_key") or (connector.config or {}).get("file_keys", [])},
            metadata={"event_types": ["FILE_COMMENT", "FILE_UPDATE", "FILE_VERSION_UPDATE"]},
        )

    def normalize_webhook_payload(self, payload: dict, headers: dict[str, str]) -> list[NormalizedTriggerEvent]:
        event_type = str(payload.get("event_type") or payload.get("eventType") or "FILE_COMMENT")
        comment = payload.get("comment") or {}
        author = payload.get("triggered_by") or {}
        external_id = str(comment.get("id") or payload.get("webhook_id") or payload.get("file_key") or "")
        if not external_id:
            return []
        text = comment.get("message") or payload.get("description") or event_type.replace("_", " ")
        return [
            NormalizedTriggerEvent(
                external_id=external_id,
                occurred_at=self.coerce_datetime(payload.get("timestamp") or payload.get("updated_at")),
                content_type="design_feedback",
                content_text=self.normalize_text(text),
                source_context={
                    "file_key": payload.get("file_key"),
                    "file_name": payload.get("file_name"),
                    "team_id": payload.get("team_id"),
                },
                author={
                    "name": author.get("handle") or author.get("name"),
                    "email": author.get("email"),
                    "external_user_id": author.get("id"),
                },
                content_metadata={"event_type": event_type, "node_id": comment.get("client_meta", {}).get("node_id")},
                raw_payload=payload,
            )
        ]
