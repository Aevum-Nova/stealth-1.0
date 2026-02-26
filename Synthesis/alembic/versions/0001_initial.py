"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-02-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    signal_status = sa.Enum(
        "pending",
        "processing",
        "completed",
        "failed",
        name="signal_status",
        create_type=False,
    )
    signal_source = sa.Enum(
        "slack",
        "google_forms",
        "zendesk",
        "servicenow",
        "figma",
        "granola",
        "intercom",
        "direct_upload",
        "api",
        name="signal_source",
        create_type=False,
    )
    signal_data_type = sa.Enum("text", "audio", "image", name="signal_data_type", create_type=False)
    sentiment = sa.Enum(
        "positive",
        "negative",
        "neutral",
        "mixed",
        name="sentiment",
        create_type=False,
    )
    urgency = sa.Enum("low", "medium", "high", "critical", name="urgency", create_type=False)

    fr_type = sa.Enum(
        "feature",
        "bug_fix",
        "improvement",
        "integration",
        "ux_change",
        name="feature_request_type",
        create_type=False,
    )
    fr_status = sa.Enum(
        "draft",
        "reviewed",
        "approved",
        "rejected",
        "merged",
        "sent_to_agent",
        name="feature_request_status",
        create_type=False,
    )
    fr_priority = sa.Enum("low", "medium", "high", "critical", name="feature_request_priority", create_type=False)

    op.create_table(
        "organizations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False, server_default="member"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_users_email", "users", ["email"], unique=True)
    op.create_index("idx_users_org", "users", ["organization_id"], unique=False)

    op.create_table(
        "refresh_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_family", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_refresh_tokens_hash", "refresh_tokens", ["token_hash"], unique=True)
    op.create_index("idx_refresh_tokens_family", "refresh_tokens", ["token_family"], unique=False)
    op.create_index("idx_refresh_tokens_user", "refresh_tokens", ["user_id"], unique=False)

    op.create_table(
        "api_keys",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("key_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_api_keys_key_hash", "api_keys", ["key_hash"], unique=True)

    op.create_table(
        "connectors",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("auto_synthesize", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("config", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("credentials", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_sync_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "signals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("status", signal_status, nullable=False, server_default="pending"),
        sa.Column("source", signal_source, nullable=False),
        sa.Column("source_data_type", signal_data_type, nullable=False),
        sa.Column("raw_artifact_r2_key", sa.Text(), nullable=False),
        sa.Column("raw_artifact_mime_type", sa.String(length=255), nullable=False),
        sa.Column("raw_artifact_size_bytes", sa.Integer(), nullable=False),
        sa.Column("transcript", sa.Text(), nullable=True),
        sa.Column("extracted_text", sa.Text(), nullable=True),
        sa.Column("original_text", sa.Text(), nullable=True),
        sa.Column("structured_summary", sa.Text(), nullable=True),
        sa.Column("entities", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("sentiment", sentiment, nullable=True),
        sa.Column("urgency", urgency, nullable=True),
        sa.Column("embedding", Vector(dim=1536), nullable=True),
        sa.Column("source_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("synthesized", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("last_synthesized_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("source_created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("processing_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("processing_completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("processing_error", sa.Text(), nullable=True),
    )
    op.create_index("idx_signals_org", "signals", ["organization_id"], unique=False)
    op.create_index("idx_signals_source", "signals", ["source"], unique=False)
    op.create_index("idx_signals_status", "signals", ["status"], unique=False)
    op.create_index("idx_signals_created_at", "signals", ["created_at"], unique=False)
    op.create_index("idx_signals_org_source", "signals", ["organization_id", "source"], unique=False)
    op.create_index("idx_signals_synthesized", "signals", ["organization_id", "synthesized"], unique=False)
    op.execute(
        "CREATE INDEX idx_signals_embedding ON signals USING ivfflat "
        "(embedding vector_cosine_ops) WITH (lists = 100)"
    )

    op.create_table(
        "synthesis_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="pending"),
        sa.Column("signal_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cluster_count", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("feature_request_count", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("feature_request_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("model", sa.String(length=100), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_synth_runs_org", "synthesis_runs", ["organization_id"], unique=False)

    op.create_table(
        "feature_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("type", fr_type, nullable=False),
        sa.Column("status", fr_status, nullable=False, server_default="draft"),
        sa.Column("priority", fr_priority, nullable=False),
        sa.Column("priority_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("problem_statement", sa.Text(), nullable=False),
        sa.Column("proposed_solution", sa.Text(), nullable=False),
        sa.Column("user_story", sa.Text(), nullable=False),
        sa.Column("acceptance_criteria", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("technical_notes", sa.Text(), nullable=True),
        sa.Column("affected_product_areas", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("supporting_evidence", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("images", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("impact_metrics", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("synthesis_run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("synthesis_runs.id"), nullable=True),
        sa.Column("synthesis_model", sa.String(length=100), nullable=True),
        sa.Column("synthesis_confidence", sa.Integer(), nullable=True),
        sa.Column("merged_into_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("feature_requests.id"), nullable=True),
        sa.Column("human_edited", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("human_edited_fields", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("human_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_fr_org", "feature_requests", ["organization_id"], unique=False)
    op.create_index("idx_fr_status", "feature_requests", ["organization_id", "status"], unique=False)
    op.create_index("idx_fr_priority", "feature_requests", ["organization_id", "priority_score"], unique=False)
    op.create_index("idx_fr_synthesis_run", "feature_requests", ["synthesis_run_id"], unique=False)

    op.create_table(
        "feature_request_signals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("feature_request_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("feature_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("signal_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("signals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("relevance_score", sa.Integer(), nullable=True),
        sa.Column("representative_quote", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_frs_feature_request", "feature_request_signals", ["feature_request_id"], unique=False)
    op.create_index("idx_frs_signal", "feature_request_signals", ["signal_id"], unique=False)
    op.create_index(
        "idx_frs_unique_pair",
        "feature_request_signals",
        ["feature_request_id", "signal_id"],
        unique=True,
    )

    op.create_table(
        "ingestion_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("connector_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="pending"),
        sa.Column("total_items", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("processed_items", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("failed_items", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("signal_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("trigger_synthesis", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("ingestion_jobs")
    op.drop_index("idx_frs_unique_pair", table_name="feature_request_signals")
    op.drop_index("idx_frs_signal", table_name="feature_request_signals")
    op.drop_index("idx_frs_feature_request", table_name="feature_request_signals")
    op.drop_table("feature_request_signals")

    op.drop_index("idx_fr_synthesis_run", table_name="feature_requests")
    op.drop_index("idx_fr_priority", table_name="feature_requests")
    op.drop_index("idx_fr_status", table_name="feature_requests")
    op.drop_index("idx_fr_org", table_name="feature_requests")
    op.drop_table("feature_requests")

    op.drop_index("idx_synth_runs_org", table_name="synthesis_runs")
    op.drop_table("synthesis_runs")

    op.execute("DROP INDEX IF EXISTS idx_signals_embedding")
    op.drop_index("idx_signals_synthesized", table_name="signals")
    op.drop_index("idx_signals_org_source", table_name="signals")
    op.drop_index("idx_signals_created_at", table_name="signals")
    op.drop_index("idx_signals_status", table_name="signals")
    op.drop_index("idx_signals_source", table_name="signals")
    op.drop_index("idx_signals_org", table_name="signals")
    op.drop_table("signals")

    op.drop_table("connectors")

    op.drop_index("ix_api_keys_key_hash", table_name="api_keys")
    op.drop_table("api_keys")

    op.drop_index("idx_refresh_tokens_user", table_name="refresh_tokens")
    op.drop_index("idx_refresh_tokens_family", table_name="refresh_tokens")
    op.drop_index("idx_refresh_tokens_hash", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")

    op.drop_index("idx_users_org", table_name="users")
    op.drop_index("idx_users_email", table_name="users")
    op.drop_table("users")

    op.drop_table("organizations")

    sa.Enum(name="feature_request_priority").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="feature_request_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="feature_request_type").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="urgency").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="sentiment").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="signal_data_type").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="signal_source").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="signal_status").drop(op.get_bind(), checkfirst=True)
