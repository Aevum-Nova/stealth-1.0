from src.triggers.adapters.figma import FigmaTriggerAdapter
from src.triggers.adapters.google_forms import GoogleFormsTriggerAdapter
from src.triggers.adapters.intercom import IntercomTriggerAdapter
from src.triggers.adapters.microsoft_teams import MicrosoftTeamsTriggerAdapter
from src.triggers.adapters.slack import SlackTriggerAdapter
from src.triggers.adapters.zendesk import ZendeskTriggerAdapter

TRIGGER_ADAPTERS = {
    "slack": SlackTriggerAdapter(),
    "microsoft_teams": MicrosoftTeamsTriggerAdapter(),
    "google_forms": GoogleFormsTriggerAdapter(),
    "zendesk": ZendeskTriggerAdapter(),
    "figma": FigmaTriggerAdapter(),
    "intercom": IntercomTriggerAdapter(),
}

__all__ = ["TRIGGER_ADAPTERS"]
