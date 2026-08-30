from dataclasses import dataclass, field
from enum import Enum
from uuid import UUID, uuid4
from datetime import datetime, timezone


class AnswerStatus(Enum):
    ANSWERED = "ANSWERED"
    PARTIAL_ANSWER = "PARTIAL_ANSWER"
    DOES_NOT_KNOW = "DOES_NOT_KNOW"
    NEEDS_CLARIFICATION = "NEEDS_CLARIFICATION"


@dataclass
class Answer:
    question_id: UUID = field(default_factory=uuid4)
    transcript: str = ""
    answer_status: AnswerStatus | None = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
