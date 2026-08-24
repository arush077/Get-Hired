from dataclasses import dataclass, field
from uuid import UUID, uuid4
from datetime import datetime, timezone


@dataclass
class Chunk:
    id: UUID = field(default_factory=uuid4)
    source: str = ""          # "resume" or "job_description"
    text: str = ""            # the actual text chunk
    embedding: list[float] = field(default_factory=list)  # vector of numbers
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
