from dataclasses import dataclass, field
from uuid import UUID, uuid4


@dataclass
class Question:
    id: UUID = field(default_factory=uuid4)
    text: str = ""
    type: str = "technical"
    order: int = 0
