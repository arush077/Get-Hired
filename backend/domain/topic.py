from dataclasses import dataclass, field
from enum import Enum


class TopicStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    ACTIVE = "ACTIVE"
    EXHAUSTED = "EXHAUSTED"
    SKIPPED = "SKIPPED"


@dataclass
class TopicEntry:
    id: str
    label: str
    source: str
    primary_question: str
    priority: int
    status: TopicStatus = TopicStatus.AVAILABLE
    questions_asked: int = 0
    exhaustion_reason: str | None = None
