from __future__ import annotations

from src.models.connector import Connector
from src.triggers.adapters.base import (
    BaseTriggerAdapter,
    NormalizedTriggerEvent,
    ScopeFieldDefinition,
    ScopeOptionDefinition,
    SubscriptionPlan,
)


class ZendeskTriggerAdapter(BaseTriggerAdapter):
    plugin_type = "zendesk"
    display_name = "Zendesk"
    icon = "zendesk"
    adapter_kind = "webhook"
    install_hint = "Zendesk can either subscribe this webhook to ticket events or connect it to a business-rule trigger."

    def build_scope_fields(self, connector: Connector) -> list[ScopeFieldDefinition]:
        statuses = [str(value) for value in (connector.config or {}).get("ticket_statuses", []) if str(value).strip()]
        tags = [str(value) for value in (connector.config or {}).get("tag_names", []) if str(value).strip()]
        return [
            ScopeFieldDefinition(
                key="ticket_status",
                label="Ticket statuses",
                multiple=True,
                options=[ScopeOptionDefinition(label=value, value=value) for value in statuses],
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
            external_subscription_id=f"zendesk-{connector.id}",
            scope_config={
                "ticket_status": scope.get("ticket_status") or (connector.config or {}).get("ticket_statuses", []),
                "tag": scope.get("tag") or (connector.config or {}).get("tag_names", []),
            },
            metadata={"event_types": ["ticket.created", "ticket.updated", "ticket.comment_added"]},
        )

    def normalize_webhook_payload(self, payload: dict, headers: dict[str, str]) -> list[NormalizedTriggerEvent]:
        ticket = payload.get("ticket") if isinstance(payload.get("ticket"), dict) else payload
        external_id = str(ticket.get("id") or payload.get("id") or "")
        if not external_id:
            return []
        comment = payload.get("comment") or {}
        author = comment.get("author") or ticket.get("requester") or {}
        tags = ticket.get("tags") or payload.get("tags") or []
        text = comment.get("body") or ticket.get("description") or ticket.get("subject") or ""
        return [
            NormalizedTriggerEvent(
                external_id=external_id,
                occurred_at=self.coerce_datetime(ticket.get("updated_at") or ticket.get("created_at")),
                content_type="ticket",
                content_text=self.normalize_text(text),
                source_context={
                    "ticket_status": ticket.get("status"),
                    "ticket_id": ticket.get("id"),
                    "tag": tags[0] if tags else None,
                    "subdomain": payload.get("subdomain") or (ticket.get("via") or {}).get("source", {}).get("from", {}).get("address"),
                },
                author={
                    "name": author.get("name"),
                    "email": author.get("email"),
                    "external_user_id": author.get("id"),
                },
                content_metadata={"tags": tags, "priority": ticket.get("priority")},
                raw_payload=payload,
            )
        ]
