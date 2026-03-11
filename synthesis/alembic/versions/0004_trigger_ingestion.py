"""add trigger ingestion tables and synthesis scoping

Revision ID: 0004_trigger_ingestion
Revises: 0003_agent_tables
Create Date: 2026-03-08
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0004_trigger_ingestion"
down_revision: str | None = "0003_agent_tables"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


UUID = postgresql.UUID(as_uuid=True)
JSONB = postgresql.JSONB(astext_type=sa.Text())


def upgrade() -> None:
    op.execute("ALTER TYPE signal_source ADD VALUE IF NOT EXISTS 'microsoft_teams'")

    op.create_table(
        "triggers",
        sa.Column("id", UUID, primary_key=True, nullable=False),
        sa.Column("organization_id", UUID, nullable=False),
        sa.Column("connector_id", UUID, sa.ForeignKey("connectors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by_user_id", UUID, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("plugin_type", sa.String(length=50), nullable=False),
        sa.Column("natural_language_description", sa.Text(), nullable=False),
        sa.Column("parsed_filter_criteria", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("scope", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("scope_summary", sa.Text(), nullable=False, server_default=sa.text("'All activity'")),
        sa.Column("status", sa.String(length=32), nullable=False, server_default=sa.text("'active'")),
        sa.Column("buffer_config", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("match_config", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("last_event_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_dispatch_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_triggers_org", "triggers", ["organization_id"])
    op.create_index("idx_triggers_connector", "triggers", ["connector_id"])
    op.create_index("idx_triggers_status", "triggers", ["organization_id", "status"])
    op.create_index("idx_triggers_plugin", "triggers", ["organization_id", "plugin_type"])

    op.create_table(
        "webhook_subscriptions",
        sa.Column("id", UUID, primary_key=True, nullable=False),
        sa.Column("organization_id", UUID, nullable=False),
        sa.Column("trigger_id", UUID, sa.ForeignKey("triggers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("connector_id", UUID, sa.ForeignKey("connectors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("plugin_type", sa.String(length=50), nullable=False),
        sa.Column("adapter_kind", sa.String(length=32), nullable=False, server_default=sa.text("'webhook'")),
        sa.Column("external_subscription_id", sa.String(length=255), nullable=True),
        sa.Column("callback_url", sa.Text(), nullable=False),
        sa.Column("subscription_expiry", sa.DateTime(timezone=True), nullable=True),
        sa.Column("scope_config", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("status", sa.String(length=32), nullable=False, server_default=sa.text("'active'")),
        sa.Column("metadata", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_webhook_sub_trigger", "webhook_subscriptions", ["trigger_id"])
    op.create_index("idx_webhook_sub_status", "webhook_subscriptions", ["organization_id", "status"])

    op.create_table(
        "event_buffers",
        sa.Column("id", UUID, primary_key=True, nullable=False),
        sa.Column("organization_id", UUID, nullable=False),
        sa.Column("trigger_id", UUID, sa.ForeignKey("triggers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_ids", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("signal_ids", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("event_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("status", sa.String(length=32), nullable=False, server_default=sa.text("'open'")),
        sa.Column("buffer_started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("last_event_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dispatched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("synthesis_run_id", UUID, sa.ForeignKey("synthesis_runs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("metadata", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_event_buffers_trigger", "event_buffers", ["trigger_id"])
    op.create_index("idx_event_buffers_status", "event_buffers", ["organization_id", "status"])

    op.create_table(
        "ingested_events",
        sa.Column("id", UUID, primary_key=True, nullable=False),
        sa.Column("organization_id", UUID, nullable=False),
        sa.Column("trigger_id", UUID, sa.ForeignKey("triggers.id", ondelete="CASCADE"), nullable=True),
        sa.Column("event_buffer_id", UUID, sa.ForeignKey("event_buffers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("plugin_type", sa.String(length=50), nullable=False),
        sa.Column("external_id", sa.String(length=255), nullable=False),
        sa.Column("match_score", sa.Float(), nullable=True),
        sa.Column("processing_status", sa.String(length=32), nullable=False, server_default=sa.text("'received'")),
        sa.Column("raw_payload", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("normalized_payload", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("signal_id", UUID, sa.ForeignKey("signals.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_ingested_events_org", "ingested_events", ["organization_id"])
    op.create_index("idx_ingested_events_trigger", "ingested_events", ["trigger_id"])
    op.create_index("idx_ingested_events_status", "ingested_events", ["organization_id", "processing_status"])
    op.create_index("idx_ingested_events_ext", "ingested_events", ["plugin_type", "external_id"])

    op.add_column("signals", sa.Column("trigger_id", UUID, sa.ForeignKey("triggers.id"), nullable=True))
    op.add_column("signals", sa.Column("ingested_event_id", UUID, sa.ForeignKey("ingested_events.id"), nullable=True))
    op.add_column("signals", sa.Column("event_buffer_id", UUID, sa.ForeignKey("event_buffers.id"), nullable=True))
    op.create_index("idx_signals_trigger", "signals", ["trigger_id"])
    op.create_index("idx_signals_ingested_event", "signals", ["ingested_event_id"])

    op.add_column("synthesis_runs", sa.Column("trigger_id", UUID, nullable=True))
    op.add_column("synthesis_runs", sa.Column("event_buffer_id", UUID, nullable=True))
    op.add_column("synthesis_runs", sa.Column("input_signal_ids", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")))
    op.add_column("synthesis_runs", sa.Column("trigger_context", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("synthesis_runs", "trigger_context")
    op.drop_column("synthesis_runs", "input_signal_ids")
    op.drop_column("synthesis_runs", "event_buffer_id")
    op.drop_column("synthesis_runs", "trigger_id")

    op.drop_index("idx_signals_ingested_event", table_name="signals")
    op.drop_index("idx_signals_trigger", table_name="signals")
    op.drop_column("signals", "event_buffer_id")
    op.drop_column("signals", "ingested_event_id")
    op.drop_column("signals", "trigger_id")

    op.drop_index("idx_ingested_events_ext", table_name="ingested_events")
    op.drop_index("idx_ingested_events_status", table_name="ingested_events")
    op.drop_index("idx_ingested_events_trigger", table_name="ingested_events")
    op.drop_index("idx_ingested_events_org", table_name="ingested_events")
    op.drop_table("ingested_events")

    op.drop_index("idx_event_buffers_status", table_name="event_buffers")
    op.drop_index("idx_event_buffers_trigger", table_name="event_buffers")
    op.drop_table("event_buffers")

    op.drop_index("idx_webhook_sub_status", table_name="webhook_subscriptions")
    op.drop_index("idx_webhook_sub_trigger", table_name="webhook_subscriptions")
    op.drop_table("webhook_subscriptions")

    op.drop_index("idx_triggers_plugin", table_name="triggers")
    op.drop_index("idx_triggers_status", table_name="triggers")
    op.drop_index("idx_triggers_connector", table_name="triggers")
    op.drop_index("idx_triggers_org", table_name="triggers")
    op.drop_table("triggers")
