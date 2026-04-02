"""add webhook_token to connectors for org-scoped webhook URLs

Revision ID: 0007_connector_webhook_token
Revises: 0006_fr_embedding
Create Date: 2026-03-30
"""

import secrets
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007_connector_webhook_token"
down_revision: str = "0006_fr_embedding"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    # Add column as nullable first so existing rows don't fail
    op.add_column("connectors", sa.Column("webhook_token", sa.String(64), nullable=True))

    # Backfill existing connectors with unique tokens
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id FROM connectors WHERE webhook_token IS NULL"))
    for (row_id,) in rows:
        token = secrets.token_urlsafe(32)
        conn.execute(
            sa.text("UPDATE connectors SET webhook_token = :token WHERE id = :id"),
            {"token": token, "id": row_id},
        )

    # Now make it non-nullable and add unique index
    op.alter_column("connectors", "webhook_token", nullable=False)
    op.create_index("idx_connectors_webhook_token", "connectors", ["webhook_token"], unique=True)


def downgrade() -> None:
    op.drop_index("idx_connectors_webhook_token", table_name="connectors")
    op.drop_column("connectors", "webhook_token")
