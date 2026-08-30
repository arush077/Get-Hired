from dataclasses import dataclass, field
from uuid import UUID, uuid4
from datetime import datetime, timezone


@dataclass
class Document:
    id: UUID = field(default_factory=uuid4)
    document_type: str = ""  # "resume" or "job_description"
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class DocumentChunk:
    id: UUID = field(default_factory=uuid4)
    document_id: UUID = field(default_factory=uuid4)
    chunk_index: int = 0
    content: str = ""
    embedding: list[float] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
