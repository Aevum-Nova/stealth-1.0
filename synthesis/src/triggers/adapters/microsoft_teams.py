from __future__ import annotations

from src.models.connector import Connector
from src.triggers.adapters.base import (
    BaseTriggerAdapter,
    NormalizedTriggerEvent,
    ScopeFieldDefinition,
    ScopeOptionDefinition,
    SubscriptionPlan,
)


class MicrosoftTeamsTriggerAdapter(BaseTriggerAdapter):
    plugin_type = "microsoft_teams"
    display_name = "Microsoft Teams"
    icon = "teams"
    adapter_kind = "bot"
    install_hint = "Install the bot in the target team or channel, or let Graph subscriptions monitor the selected channels."

    def build_scope_fields(self, connector: Connector) -> list[ScopeFieldDefinition]:
        teams = [str(value) for value in (connector.config or {}).get("team_ids", []) if str(value).strip()]
        channels = [str(value) for value in (connector.config or {}).get("channel_ids", []) if str(value).strip()]
        return [
            ScopeFieldDefinition(
                key="team_id",
                label="Teams",
                multiple=True,
                options=[ScopeOptionDefinition(label=value, value=value) for value in teams],
            ),
            ScopeFieldDefinition(
                key="channel_id",
                label="Channels",
                multiple=True,
                options=[ScopeOptionDefinition(label=value, value=value) for value in channels],
            ),
        ]

    def build_subscription_plan(self, connector: Connector, scope: dict, callback_url: str) -> SubscriptionPlan:
        return SubscriptionPlan(
            adapter_kind=self.adapter_kind,
            callback_url=callback_url,
            external_subscription_id=f"teams-{connector.id}",
            scope_config={
                "team_id": scope.get("team_id") or (connector.config or {}).get("team_ids", []),
                "channel_id": scope.get("channel_id") or (connector.config or {}).get("channel_ids", []),
            },
            metadata={"notification_resource": "/teams/{team-id}/channels/{channel-id}/messages"},
        )

    def normalize_webhook_payload(self, payload: dict, headers: dict[str, str]) -> list[NormalizedTriggerEvent]:
        if isinstance(payload.get("value"), list):
            normalized: list[NormalizedTriggerEvent] = []
            for item in payload["value"]:
                resource = item.get("resourceData") or {}
                normalized.extend(self.normalize_webhook_payload(resource, headers))
            return normalized

        external_id = str(payload.get("id") or payload.get("messageId") or "")
        if not external_id:
            return []
        author = payload.get("from") or {}
        body = payload.get("body") or {}
        return [
            NormalizedTriggerEvent(
                external_id=external_id,
                occurred_at=self.coerce_datetime(payload.get("createdDateTime") or payload.get("lastModifiedDateTime")),
                content_type="message",
                content_text=self.normalize_text(body.get("content") or payload.get("text")),
                source_context={
                    "team_id": payload.get("teamId"),
                    "channel_id": payload.get("channelId"),
                    "tenant_id": payload.get("tenantId"),
                    "reply_to_id": payload.get("replyToId"),
                },
                author={
                    "name": author.get("user", {}).get("displayName") or author.get("displayName"),
                    "email": author.get("user", {}).get("email") or author.get("email"),
                    "external_user_id": author.get("user", {}).get("id") or author.get("id"),
                },
                content_metadata={"importance": payload.get("importance")},
                raw_payload=payload,
            )
        ]
