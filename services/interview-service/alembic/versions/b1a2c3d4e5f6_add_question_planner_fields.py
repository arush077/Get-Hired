"""add question planner fields

Revision ID: b1a2c3d4e5f6
Revises: 4ff980220bd7
Create Date: 2026-08-24 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1a2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '4ff980220bd7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_columns = {col['name'] for col in inspector.get_columns('interviews')}
    question_columns = {col['name'] for col in inspector.get_columns('questions')}

    if 'total_questions' not in existing_columns:
        op.add_column('interviews', sa.Column('total_questions', sa.Integer(), nullable=False, server_default='10'))
    if 'topics' not in existing_columns:
        op.add_column('interviews', sa.Column('topics', sa.Text(), nullable=False, server_default='[]'))
    if 'topics_covered' not in existing_columns:
        op.add_column('interviews', sa.Column('topics_covered', sa.Text(), nullable=False, server_default='[]'))
    if 'question_type' not in question_columns:
        op.add_column('questions', sa.Column('question_type', sa.String(length=20), nullable=False, server_default='PRIMARY'))


def downgrade() -> None:
    op.drop_column('questions', 'question_type')
    op.drop_column('interviews', 'topics_covered')
    op.drop_column('interviews', 'topics')
    op.drop_column('interviews', 'total_questions')
