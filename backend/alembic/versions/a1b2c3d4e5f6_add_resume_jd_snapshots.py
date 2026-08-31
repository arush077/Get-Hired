"""add resume/jd snapshots and provenance fields

Revision ID: a1b2c3d4e5f6
Revises: d3e4f5a6b7c8
Create Date: 2026-08-31 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'f5a6b7c8d9e0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    interview_columns = {col['name'] for col in inspector.get_columns('interviews')}

    if 'resume_snapshot' not in interview_columns:
        op.add_column('interviews', sa.Column('resume_snapshot', sa.Text(), nullable=False, server_default=''))
    if 'jd_snapshot' not in interview_columns:
        op.add_column('interviews', sa.Column('jd_snapshot', sa.Text(), nullable=False, server_default=''))


def downgrade() -> None:
    op.drop_column('interviews', 'jd_snapshot')
    op.drop_column('interviews', 'resume_snapshot')
