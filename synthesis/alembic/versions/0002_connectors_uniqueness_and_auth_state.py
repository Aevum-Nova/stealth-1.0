"""enforce connector uniqueness and auth state

Revision ID: 0002_connectors_unique
Revises: 0001_initial
Create Date: 2026-02-26
"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002_connectors_unique"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Keep one connector per (organization_id, type). Prefer rows with credentials.
    op.execute(
        """
        WITH ranked AS (
            SELECT
                id,
                row_number() OVER (
                    PARTITION BY organization_id, type
                    ORDER BY
                        CASE
                            WHEN credentials IS NULL OR credentials = '{}'::jsonb THEN 1
                            ELSE 0
                        END,
                        updated_at DESC,
                        created_at DESC,
                        id DESC
                ) AS rn
            FROM connectors
        )
        DELETE FROM connectors c
        USING ranked r
        WHERE c.id = r.id AND r.rn > 1
        """
    )

    # OAuth connectors without credentials should not be active.
    op.execute(
        """
        UPDATE connectors
        SET enabled = false
        WHERE type IN ('slack', 'google_forms', 'zendesk', 'servicenow', 'figma', 'intercom')
          AND (credentials IS NULL OR credentials = '{}'::jsonb)
        """
    )

    op.create_index(
        "uq_connectors_org_type",
        "connectors",
        ["organization_id", "type"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_connectors_org_type", table_name="connectors")
