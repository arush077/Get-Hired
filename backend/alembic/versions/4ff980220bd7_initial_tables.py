"""initial tables

Revision ID: 4ff980220bd7
Revises: 
Create Date: 2026-08-23 21:37:57.764925

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4ff980220bd7'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    existing_tables = inspector.get_table_names()

    if 'interviews' not in existing_tables:
        op.create_table('interviews',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('candidate_name', sa.String(length=255), nullable=False),
        sa.Column('job_role', sa.String(length=255), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('current_question_index', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
        )

    if 'questions' not in existing_tables:
        op.create_table('questions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('interview_id', sa.UUID(), nullable=False),
        sa.Column('question_text', sa.Text(), nullable=False),
        sa.Column('question_index', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['interview_id'], ['interviews.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
        )

    if 'answers' not in existing_tables:
        op.create_table('answers',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('interview_id', sa.UUID(), nullable=False),
        sa.Column('question_id', sa.UUID(), nullable=False),
        sa.Column('transcript', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['interview_id'], ['interviews.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['question_id'], ['questions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('answers')
    op.drop_table('questions')
    op.drop_table('interviews')
