"""dedupe and enforce unique agent conversations per feature request/org

Revision ID: 0005_agent_conv_unique
Revises: 0004_code_index
Create Date: 2026-03-16
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0005_agent_conv_unique"
down_revision: str | None = "0004_code_index"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        WITH ranked AS (
            SELECT
                id,
                FIRST_VALUE(id) OVER (
                    PARTITION BY feature_request_id, organization_id
                    ORDER BY created_at, id
                ) AS canonical_id,
                ROW_NUMBER() OVER (
                    PARTITION BY feature_request_id, organization_id
                    ORDER BY created_at, id
                ) AS row_num
            FROM agent_conversations
        ),
        duplicates AS (
            SELECT id, canonical_id
            FROM ranked
            WHERE row_num > 1
        )
        UPDATE agent_messages AS msg
        SET conversation_id = dup.canonical_id
        FROM duplicates AS dup
        WHERE msg.conversation_id = dup.id
        """
    )

    op.execute(
        """
        WITH ranked AS (
            SELECT
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY feature_request_id, organization_id
                    ORDER BY created_at, id
                ) AS row_num
            FROM agent_conversations
        )
        DELETE FROM agent_conversations AS conv
        USING ranked
        WHERE conv.id = ranked.id
          AND ranked.row_num > 1
        """
    )

    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_conv_feature_request_org
        ON agent_conversations (feature_request_id, organization_id)
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_agent_conv_feature_request_org")
