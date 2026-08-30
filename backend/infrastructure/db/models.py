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
from pgvector.sqlalchemy import Vector


class Base(DeclarativeBase):
    pass


# ── Interview tables ──────────────────────────────────────────────


class InterviewModel(Base):
    __tablename__ = "interviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    candidate_name = Column(String(255), nullable=False)
    job_role = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False, default="CREATED")
    resume_id = Column(UUID(as_uuid=True), ForeignKey("resumes.id", ondelete="SET NULL"), nullable=True)
    current_question_index = Column(Integer, nullable=False, default=0)
    total_questions = Column(Integer, nullable=False, default=10)
    topic_plan = Column(Text, nullable=False, default="[]")
    current_topic_id = Column(String(255), nullable=True)
    analysis = Column(Text, nullable=True, default=None)
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
    answer_status = Column(String(20), nullable=True)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    interview = relationship("InterviewModel", back_populates="answers")


# ── RAG tables ────────────────────────────────────────────────────


class DocumentModel(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_type = Column(String(50), nullable=False)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class DocumentChunkModel(Base):
    __tablename__ = "document_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(768), nullable=False)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class InterviewDocumentModel(Base):
    __tablename__ = "interview_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    interview_id = Column(UUID(as_uuid=True), nullable=False)
    resume_document_id = Column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    jd_document_id = Column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


# ── Auth tables ──────────────────────────────────────────────────


class UserModel(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


# ── Resume tables ────────────────────────────────────────────────


class ResumeModel(Base):
    __tablename__ = "resumes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title = Column(String(255), nullable=False, default="Untitled Resume")
    personal_info = Column(Text, nullable=False, default="{}")
    skills = Column(Text, nullable=False, default="")
    template = Column(String(50), nullable=False, default="classic")
    section_order = Column(Text, nullable=False, default='["education","skills","experience","projects"]')
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("UserModel", backref="resumes")
    education = relationship(
        "ResumeEducationModel", back_populates="resume", cascade="all, delete-orphan",
        order_by="ResumeEducationModel.sort_order",
    )
    experience = relationship(
        "ResumeExperienceModel", back_populates="resume", cascade="all, delete-orphan",
        order_by="ResumeExperienceModel.sort_order",
    )
    projects = relationship(
        "ResumeProjectModel", back_populates="resume", cascade="all, delete-orphan",
        order_by="ResumeProjectModel.sort_order",
    )


class ResumeEducationModel(Base):
    __tablename__ = "resume_education"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resume_id = Column(
        UUID(as_uuid=True), ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False
    )
    sort_order = Column(Integer, nullable=False, default=0)
    college = Column(String(255), nullable=False, default="")
    degree = Column(String(255), nullable=False, default="")
    cgpa = Column(String(50), nullable=False, default="")
    start_year = Column(String(20), nullable=False, default="")
    end_year = Column(String(20), nullable=False, default="")

    resume = relationship("ResumeModel", back_populates="education")


class ResumeExperienceModel(Base):
    __tablename__ = "resume_experience"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resume_id = Column(
        UUID(as_uuid=True), ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False
    )
    sort_order = Column(Integer, nullable=False, default=0)
    company = Column(String(255), nullable=False, default="")
    role = Column(String(255), nullable=False, default="")
    description = Column(Text, nullable=False, default="")

    resume = relationship("ResumeModel", back_populates="experience")


class ResumeProjectModel(Base):
    __tablename__ = "resume_projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resume_id = Column(
        UUID(as_uuid=True), ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False
    )
    sort_order = Column(Integer, nullable=False, default=0)
    name = Column(String(255), nullable=False, default="")
    technologies = Column(String(500), nullable=False, default="")
    description = Column(Text, nullable=False, default="")

    resume = relationship("ResumeModel", back_populates="projects")
