from dataclasses import dataclass, field
from uuid import UUID, uuid4
from datetime import datetime, timezone


@dataclass
class Answer:
    question_id: UUID = field(default_factory=uuid4)
    transcript: str = ""
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
