"""add agent_conversations, agent_messages, agent_jobs tables

Revision ID: 0003_agent_tables
Revises: 0002_connectors_unique
Create Date: 2026-03-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = "0003_agent_tables"
down_revision: str | None = "0002_connectors_unique"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("DO $$ BEGIN CREATE TYPE agent_message_role AS ENUM ('user', 'assistant', 'system'); EXCEPTION WHEN duplicate_object THEN NULL; END $$")
    op.execute("DO $$ BEGIN CREATE TYPE agent_job_status AS ENUM ('pending', 'running', 'completed', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$")

    op.execute("""
        CREATE TABLE IF NOT EXISTS agent_conversations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            feature_request_id UUID NOT NULL REFERENCES feature_requests(id),
            organization_id UUID NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS agent_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            conversation_id UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
            role agent_message_role NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS agent_jobs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            feature_request_id UUID NOT NULL REFERENCES feature_requests(id),
            organization_id UUID NOT NULL,
            status agent_job_status NOT NULL DEFAULT 'pending',
            result JSONB,
            error TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS idx_agent_conv_fr ON agent_conversations (feature_request_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_agent_conv_org ON agent_conversations (organization_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_agent_msg_conv ON agent_messages (conversation_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_agent_job_fr ON agent_jobs (feature_request_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_agent_job_org ON agent_jobs (organization_id)")


def downgrade() -> None:
    op.drop_table("agent_jobs")
    op.drop_table("agent_messages")
    op.drop_table("agent_conversations")
    op.execute("DROP TYPE IF EXISTS agent_job_status")
    op.execute("DROP TYPE IF EXISTS agent_message_role")
