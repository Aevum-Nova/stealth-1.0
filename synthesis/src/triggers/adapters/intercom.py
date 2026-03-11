from __future__ import annotations

from src.models.connector import Connector
from src.triggers.adapters.base import (
    BaseTriggerAdapter,
    NormalizedTriggerEvent,
    ScopeFieldDefinition,
    ScopeOptionDefinition,
    SubscriptionPlan,
)


class IntercomTriggerAdapter(BaseTriggerAdapter):
    plugin_type = "intercom"
    display_name = "Intercom"
    icon = "intercom"
    adapter_kind = "webhook"
    install_hint = "Subscribe the Intercom app to conversation topics and use tags or states to narrow the trigger scope."

    def build_scope_fields(self, connector: Connector) -> list[ScopeFieldDefinition]:
        states = [str(value) for value in (connector.config or {}).get("conversation_states", []) if str(value).strip()]
        tags = [str(value) for value in (connector.config or {}).get("tag_names", []) if str(value).strip()]
        return [
            ScopeFieldDefinition(
                key="conversation_state",
                label="Conversation states",
                multiple=True,
                options=[ScopeOptionDefinition(label=value, value=value) for value in states],
            ),
            ScopeFieldDefinition(
                key="tag",
                label="Tags",
                multiple=True,
                options=[ScopeOptionDefinition(label=value, value=value) for value in tags],
            ),
        ]

    def build_subscription_plan(self, connector: Connector, scope: dict, callback_url: str) -> SubscriptionPlan:
        return SubscriptionPlan(
            adapter_kind=self.adapter_kind,
            callback_url=callback_url,
            external_subscription_id=f"intercom-{connector.id}",
            scope_config={
                "conversation_state": scope.get("conversation_state") or (connector.config or {}).get("conversation_states", []),
                "tag": scope.get("tag") or (connector.config or {}).get("tag_names", []),
            },
            metadata={"topics": ["conversation.user.created", "conversation.user.replied", "conversation.admin.noted"]},
        )

    def normalize_webhook_payload(self, payload: dict, headers: dict[str, str]) -> list[NormalizedTriggerEvent]:
        data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
        item = data.get("item") if isinstance(data.get("item"), dict) else data
        parts = item.get("conversation_parts", {}).get("conversation_parts") or []
        last_part = parts[-1] if parts else {}
        author = last_part.get("author") or item.get("source", {}).get("author") or {}
        external_id = str(item.get("id") or payload.get("id") or "")
        if not external_id:
            return []
        text = last_part.get("body") or item.get("source", {}).get("body") or item.get("title") or ""
        tags = [tag.get("name") for tag in item.get("tags", {}).get("tags", []) if tag.get("name")]
        return [
            NormalizedTriggerEvent(
                external_id=external_id,
                occurred_at=self.coerce_datetime(item.get("updated_at") or payload.get("created_at")),
                content_type="ticket",
                content_text=self.normalize_text(text),
                source_context={
                    "conversation_id": item.get("id"),
                    "conversation_state": item.get("state"),
                    "tag": tags[0] if tags else None,
                },
                author={
                    "name": author.get("name"),
                    "email": author.get("email"),
                    "external_user_id": author.get("id"),
                },
                content_metadata={"tags": tags, "priority": item.get("priority")},
                raw_payload=payload,
            )
        ]
