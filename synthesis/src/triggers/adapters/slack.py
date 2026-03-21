from __future__ import annotations

from src.models.connector import Connector
from src.triggers.adapters.base import (
    BaseTriggerAdapter,
    NormalizedTriggerEvent,
    ScopeFieldDefinition,
    ScopeOptionDefinition,
    SubscriptionPlan,
)


class SlackTriggerAdapter(BaseTriggerAdapter):
    plugin_type = "slack"
    display_name = "Slack"
    icon = "slack"
    adapter_kind = "bot"
    install_hint = "Invite the Slack bot to each channel you want a trigger to monitor."

    def build_scope_fields(self, connector: Connector) -> list[ScopeFieldDefinition]:
        channels = [str(value) for value in (connector.config or {}).get("channel_ids", []) if str(value).strip()]
        options = [ScopeOptionDefinition(label=f"#{channel}", value=channel) for channel in channels]
        return [
            ScopeFieldDefinition(
                key="channel_id",
                label="Slack channels",
                multiple=True,
                help="Pick the channels this trigger should watch.",
                options=options,
            )
        ]

    def build_subscription_plan(self, connector: Connector, scope: dict, callback_url: str) -> SubscriptionPlan:
        channel_ids = scope.get("channel_id") or (connector.config or {}).get("channel_ids", [])
        return SubscriptionPlan(
            adapter_kind=self.adapter_kind,
            callback_url=callback_url,
            external_subscription_id=f"slack-events-{connector.id}",
            scope_config={"channel_id": channel_ids},
            metadata={"event_types": ["message.channels", "message.groups", "app_mention", "reaction_added"]},
        )

    def normalize_webhook_payload(self, payload: dict, headers: dict[str, str]) -> list[NormalizedTriggerEvent]:
        envelope = payload.get("event") if isinstance(payload.get("event"), dict) else payload

        # Only process plain human messages — skip bots, apps, edits, deletes,
        # joins, reactions, etc. to prevent infinite feedback loops.
        if envelope.get("bot_id") or envelope.get("app_id") or envelope.get("subtype"):
            return []

        event_type = str(envelope.get("type") or payload.get("type") or "message")
        external_id = str(envelope.get("client_msg_id") or envelope.get("event_ts") or envelope.get("ts") or "")
        if not external_id:
            return []
        return [
            NormalizedTriggerEvent(
                external_id=external_id,
                occurred_at=self.coerce_datetime(envelope.get("ts") or payload.get("event_time")),
                content_type="message",
                content_text=self.normalize_text(envelope.get("text") or payload.get("text")),
                source_context={
                    "channel_id": envelope.get("channel"),
                    "thread_ts": envelope.get("thread_ts"),
                    "workspace_id": payload.get("team_id"),
                },
                author={"external_user_id": envelope.get("user")},
                content_metadata={"event_type": event_type},
                raw_payload=payload,
            )
        ]
