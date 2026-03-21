"""add embedding column to feature_requests for cross-run deduplication

Revision ID: 0006_fr_embedding
Revises: 0005_agent_conv_unique
Create Date: 2026-03-21
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

revision: str = "0006_fr_embedding"
down_revision: tuple[str, ...] = ("0005_agent_conv_unique", "0004_trigger_ingestion")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("feature_requests", sa.Column("embedding", Vector(dim=1536), nullable=True))
    op.execute(
        "CREATE INDEX idx_fr_embedding ON feature_requests "
        "USING hnsw (embedding vector_cosine_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_fr_embedding")
    op.drop_column("feature_requests", "embedding")
