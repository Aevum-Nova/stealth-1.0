from __future__ import annotations

from src.models.connector import Connector
from src.triggers.adapters.base import (
    BaseTriggerAdapter,
    NormalizedTriggerEvent,
    ScopeFieldDefinition,
    ScopeOptionDefinition,
    SubscriptionPlan,
)


class GoogleFormsTriggerAdapter(BaseTriggerAdapter):
    plugin_type = "google_forms"
    display_name = "Google Forms"
    icon = "google_forms"
    adapter_kind = "watch"
    install_hint = "A Forms watch is created per selected form and renewed automatically before expiry."

    def build_scope_fields(self, connector: Connector) -> list[ScopeFieldDefinition]:
        forms = [str(value) for value in (connector.config or {}).get("form_ids", []) if str(value).strip()]
        return [
            ScopeFieldDefinition(
                key="form_id",
                label="Forms",
                multiple=True,
                required=True,
                options=[ScopeOptionDefinition(label=value, value=value) for value in forms],
            )
        ]

    def build_subscription_plan(self, connector: Connector, scope: dict, callback_url: str) -> SubscriptionPlan:
        return SubscriptionPlan(
            adapter_kind=self.adapter_kind,
            callback_url=callback_url,
            external_subscription_id=f"forms-watch-{connector.id}",
            scope_config={"form_id": scope.get("form_id") or (connector.config or {}).get("form_ids", [])},
            metadata={"event_type": "RESPONSES"},
        )

    def normalize_webhook_payload(self, payload: dict, headers: dict[str, str]) -> list[NormalizedTriggerEvent]:
        response = payload.get("response") if isinstance(payload.get("response"), dict) else payload
        external_id = str(response.get("responseId") or response.get("id") or "")
        if not external_id:
            return []

        answers = response.get("answers") or {}
        answer_parts: list[str] = []
        for key, value in answers.items():
            if isinstance(value, dict):
                answer = value.get("textAnswers", {}).get("answers") or value.get("value") or value
            else:
                answer = value
            answer_parts.append(f"{key}: {answer}")

        return [
            NormalizedTriggerEvent(
                external_id=external_id,
                occurred_at=self.coerce_datetime(response.get("lastSubmittedTime") or response.get("createTime")),
                content_type="form_response",
                content_text="\n".join(answer_parts) if answer_parts else self.normalize_text(response),
                source_context={"form_id": response.get("formId") or payload.get("formId")},
                author={"external_user_id": response.get("respondentEmail")},
                content_metadata={"answers": answers},
                raw_payload=payload,
            )
        ]
