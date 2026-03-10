"""add code_chunks and code_index_status tables for codebase RAG

Revision ID: 0004_code_index
Revises: 0003_agent_tables
Create Date: 2026-03-06
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0004_code_index"
down_revision: str | None = "0003_agent_tables"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # pgvector extension already created in 0001_initial

    op.execute("DO $$ BEGIN CREATE TYPE code_index_status_enum AS ENUM ('pending', 'indexing', 'ready', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$")

    op.execute("""
        CREATE TABLE IF NOT EXISTS code_index_status (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            connector_id UUID NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
            organization_id UUID NOT NULL,
            commit_sha TEXT,
            total_files INT NOT NULL DEFAULT 0,
            indexed_files INT NOT NULL DEFAULT 0,
            status code_index_status_enum NOT NULL DEFAULT 'pending',
            error TEXT,
            started_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            UNIQUE(connector_id)
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS code_chunks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            connector_id UUID NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
            organization_id UUID NOT NULL,
            file_path TEXT NOT NULL,
            start_line INT NOT NULL,
            end_line INT NOT NULL,
            content TEXT NOT NULL,
            language TEXT,
            content_hash TEXT NOT NULL,
            embedding vector(1536),
            indexed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE(connector_id, file_path, content_hash)
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS idx_code_chunks_connector ON code_chunks (connector_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_code_chunks_org ON code_chunks (organization_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_code_chunks_path ON code_chunks (connector_id, file_path)")

    # Add proposed_changes column to agent_messages for chat-suggested code changes
    op.execute("""
        ALTER TABLE agent_messages
        ADD COLUMN IF NOT EXISTS proposed_changes JSONB
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE agent_messages DROP COLUMN IF EXISTS proposed_changes")
    op.drop_table("code_chunks")
    op.drop_table("code_index_status")
    op.execute("DROP TYPE IF EXISTS code_index_status_enum")
