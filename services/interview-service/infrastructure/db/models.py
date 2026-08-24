import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class InterviewModel(Base):
    __tablename__ = "interviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_name = Column(String(255), nullable=False)
    job_role = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False, default="CREATED")
    current_question_index = Column(Integer, nullable=False, default=0)
    total_questions = Column(Integer, nullable=False, default=10)
    topics = Column(Text, nullable=False, default="[]")
    topics_covered = Column(Text, nullable=False, default="[]")
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    questions = relationship(
        "QuestionModel", back_populates="interview", cascade="all, delete-orphan"
    )
    answers = relationship(
        "AnswerModel", back_populates="interview", cascade="all, delete-orphan"
    )


class QuestionModel(Base):
    __tablename__ = "questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    interview_id = Column(
        UUID(as_uuid=True), ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False
    )
    question_text = Column(Text, nullable=False)
    question_index = Column(Integer, nullable=False)
    question_type = Column(String(20), nullable=False, default="PRIMARY")
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    interview = relationship("InterviewModel", back_populates="questions")


class AnswerModel(Base):
    __tablename__ = "answers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    interview_id = Column(
        UUID(as_uuid=True), ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False
    )
    question_id = Column(
        UUID(as_uuid=True), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False
    )
    transcript = Column(Text, nullable=False, default="")
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    interview = relationship("InterviewModel", back_populates="answers")
