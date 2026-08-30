"""replace topic fields with topic_plan

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Create Date: 2026-08-30 12:00:00.000000

"""
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e4f5a6b7c8d9'
down_revision: Union[str, Sequence[str], None] = 'd3e4f5a6b7c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    interview_columns = {col['name'] for col in inspector.get_columns('interviews')}

    if 'topic_plan' not in interview_columns:
        op.add_column('interviews', sa.Column('topic_plan', sa.Text(), nullable=False, server_default='[]'))

    if 'current_topic_id' not in interview_columns:
        op.add_column('interviews', sa.Column('current_topic_id', sa.String(255), nullable=True))

    # Migrate old topic data into topic_plan format
    conn = op.get_bind()
    result = conn.execute(sa.text("SELECT id, topics, topic_status, questions_per_topic FROM interviews"))
    for row in result:
        interview_id = row[0]
        topics_raw = row[1] or '[]'
        topic_status_raw = row[2] or '{}'
        questions_per_topic_raw = row[3] or '{}'

        topics = json.loads(topics_raw)
        topic_status = json.loads(topic_status_raw)
        questions_per_topic = json.loads(questions_per_topic_raw)

        # Build topic_plan from old data
        topic_plan = []
        for i, topic_label in enumerate(topics):
            status = topic_status.get(topic_label, "AVAILABLE")
            # Map old status values to new ones
            if status == "NEW":
                status = "AVAILABLE"
            elif status not in ("AVAILABLE", "ACTIVE", "EXHAUSTED"):
                status = "AVAILABLE"

            topic_plan.append({
                "id": f"topic_{i}",
                "label": topic_label,
                "priority": i + 1,
                "status": status,
                "questions_asked": questions_per_topic.get(topic_label, 0),
                "exhaustion_reason": None,
            })

        # Also add covered topics that were removed from topics list
        topics_covered_raw = conn.execute(
            sa.text("SELECT topics_covered FROM interviews WHERE id = :id"),
            {"id": interview_id}
        ).scalar() or '[]'
        topics_covered = json.loads(topics_covered_raw)

        existing_labels = {t["label"] for t in topic_plan}
        for i, label in enumerate(topics_covered):
            if label not in existing_labels:
                status_val = topic_status.get(label, "EXHAUSTED")
                if status_val == "NEW":
                    status_val = "EXHAUSTED"
                elif status_val not in ("AVAILABLE", "ACTIVE", "EXHAUSTED"):
                    status_val = "EXHAUSTED"

                topic_plan.append({
                    "id": f"topic_{len(topic_plan)}",
                    "label": label,
                    "priority": len(topic_plan) + 1,
                    "status": status_val,
                    "questions_asked": questions_per_topic.get(label, 0),
                    "exhaustion_reason": None,
                })

        # Set current_topic_id to first AVAILABLE or EXHAUSTED topic
        current_topic_id = None
        for t in topic_plan:
            if t["status"] in ("AVAILABLE", "ACTIVE"):
                current_topic_id = t["id"]
                break

        conn.execute(
            sa.text("UPDATE interviews SET topic_plan = :plan, current_topic_id = :tid WHERE id = :id"),
            {"plan": json.dumps(topic_plan), "tid": current_topic_id, "id": interview_id}
        )

    # Drop old columns
    op.drop_column('interviews', 'questions_per_topic')
    op.drop_column('interviews', 'topic_status')
    op.drop_column('interviews', 'topics_covered')
    op.drop_column('interviews', 'topics')


def downgrade() -> None:
    op.add_column('interviews', sa.Column('topics', sa.Text(), nullable=False, server_default='[]'))
    op.add_column('interviews', sa.Column('topics_covered', sa.Text(), nullable=False, server_default='[]'))
    op.add_column('interviews', sa.Column('topic_status', sa.Text(), nullable=False, server_default='{}'))
    op.add_column('interviews', sa.Column('questions_per_topic', sa.Text(), nullable=False, server_default='{}'))
    op.drop_column('interviews', 'current_topic_id')
    op.drop_column('interviews', 'topic_plan')
