"""Add analysis_status column to interviews

Revision ID: a6b7c8d9e0f1
Revises: c2d3e4f5a6b7
Create Date: 2026-09-07
"""
from alembic import op
import sqlalchemy as sa

revision = "a6b7c8d9e0f1"
down_revision = "c2d3e4f5a6b7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "interviews",
        sa.Column("analysis_status", sa.String(50), nullable=False, server_default="PENDING"),
    )
    # Backfill: completed interviews with analysis → COMPLETED
    op.execute(
        "UPDATE interviews SET analysis_status = 'COMPLETED' WHERE analysis IS NOT NULL"
    )
    # Backfill: completed interviews without analysis → FAILED (so get_results can regenerate)
    op.execute(
        "UPDATE interviews SET analysis_status = 'FAILED' WHERE status = 'COMPLETED' AND analysis IS NULL"
    )


def downgrade() -> None:
    op.drop_column("interviews", "analysis_status")
