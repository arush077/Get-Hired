"""add adaptive interview fields

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-08-27 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd3e4f5a6b7c8'
down_revision: Union[str, Sequence[str], None] = 'c2d3e4f5a6b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    interview_columns = {col['name'] for col in inspector.get_columns('interviews')}
    answer_columns = {col['name'] for col in inspector.get_columns('answers')}

    if 'answer_status' not in answer_columns:
        op.add_column('answers', sa.Column('answer_status', sa.String(20), nullable=True))
    if 'topic_status' not in interview_columns:
        op.add_column('interviews', sa.Column('topic_status', sa.Text(), nullable=False, server_default='{}'))
    if 'questions_per_topic' not in interview_columns:
        op.add_column('interviews', sa.Column('questions_per_topic', sa.Text(), nullable=False, server_default='{}'))


def downgrade() -> None:
    op.drop_column('interviews', 'questions_per_topic')
    op.drop_column('interviews', 'topic_status')
    op.drop_column('answers', 'answer_status')
