import json

from domain.topic import TopicEntry, TopicStatus


def serialize_topic_plan(topic_plan: list[TopicEntry]) -> str:
    return json.dumps([
        {
            "id": t.id,
            "label": t.label,
            "priority": t.priority,
            "status": t.status.value,
            "questions_asked": t.questions_asked,
            "exhaustion_reason": t.exhaustion_reason,
            "chunk_ids": t.chunk_ids,
        }
        for t in topic_plan
    ])


def deserialize_topic_plan(raw: str) -> list[TopicEntry]:
    data = json.loads(raw)
    return [
        TopicEntry(
            id=t["id"],
            label=t["label"],
            priority=t["priority"],
            status=TopicStatus(t["status"]),
            questions_asked=t.get("questions_asked", 0),
            exhaustion_reason=t.get("exhaustion_reason"),
            chunk_ids=t.get("chunk_ids", []),
        )
        for t in data
    ]
