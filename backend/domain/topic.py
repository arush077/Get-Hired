from dataclasses import dataclass, field
from enum import Enum


class TopicStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    ACTIVE = "ACTIVE"
    EXHAUSTED = "EXHAUSTED"


@dataclass
class TopicEntry:
    id: str
    label: str
    priority: int
    status: TopicStatus = TopicStatus.AVAILABLE
    questions_asked: int = 0
    exhaustion_reason: str | None = None
    source_context: str = ""
    chunk_ids: list[str] = field(default_factory=list)
