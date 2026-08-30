from dataclasses import dataclass, field
from enum import Enum
from uuid import UUID, uuid4


class QuestionType(Enum):
    HR = "HR"
    PRIMARY = "PRIMARY"
    FOLLOW_UP = "FOLLOW_UP"


@dataclass
class Question:
    id: UUID = field(default_factory=uuid4)
    text: str = ""
    question_type: QuestionType = QuestionType.PRIMARY
    order: int = 0
