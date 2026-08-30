"""add users resumes and resume_id to interviews

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d9, c8b3dbb79054
Create Date: 2026-08-30 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = 'f5a6b7c8d9e0'
down_revision: Union[str, Sequence[str], None] = ('e4f5a6b7c8d9', 'c8b3dbb79054')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users table
    op.create_table(
        'users',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Resumes table
    op.create_table(
        'resumes',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False, server_default='Untitled Resume'),
        sa.Column('personal_info', sa.Text, nullable=False, server_default='{}'),
        sa.Column('skills', sa.Text, nullable=False, server_default=''),
        sa.Column('template', sa.String(50), nullable=False, server_default='classic'),
        sa.Column('section_order', sa.Text, nullable=False, server_default='["education","skills","experience","projects"]'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('idx_resumes_user_id', 'resumes', ['user_id'])

    # Resume education
    op.create_table(
        'resume_education',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('resume_id', UUID(as_uuid=True), sa.ForeignKey('resumes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('sort_order', sa.Integer, nullable=False, server_default='0'),
        sa.Column('college', sa.String(255), nullable=False, server_default=''),
        sa.Column('degree', sa.String(255), nullable=False, server_default=''),
        sa.Column('cgpa', sa.String(50), nullable=False, server_default=''),
        sa.Column('start_year', sa.String(20), nullable=False, server_default=''),
        sa.Column('end_year', sa.String(20), nullable=False, server_default=''),
    )

    # Resume experience
    op.create_table(
        'resume_experience',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('resume_id', UUID(as_uuid=True), sa.ForeignKey('resumes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('sort_order', sa.Integer, nullable=False, server_default='0'),
        sa.Column('company', sa.String(255), nullable=False, server_default=''),
        sa.Column('role', sa.String(255), nullable=False, server_default=''),
        sa.Column('description', sa.Text, nullable=False, server_default=''),
    )

    # Resume projects
    op.create_table(
        'resume_projects',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('resume_id', UUID(as_uuid=True), sa.ForeignKey('resumes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('sort_order', sa.Integer, nullable=False, server_default='0'),
        sa.Column('name', sa.String(255), nullable=False, server_default=''),
        sa.Column('technologies', sa.String(500), nullable=False, server_default=''),
        sa.Column('description', sa.Text, nullable=False, server_default=''),
    )

    # Add user_id and resume_id to interviews
    op.add_column('interviews', sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=True))
    op.add_column('interviews', sa.Column('resume_id', UUID(as_uuid=True), sa.ForeignKey('resumes.id', ondelete='SET NULL'), nullable=True))


def downgrade() -> None:
    op.drop_column('interviews', 'resume_id')
    op.drop_column('interviews', 'user_id')
    op.drop_table('resume_projects')
    op.drop_table('resume_experience')
    op.drop_table('resume_education')
    op.drop_index('idx_resumes_user_id', table_name='resumes')
    op.drop_table('resumes')
    op.drop_table('users')
