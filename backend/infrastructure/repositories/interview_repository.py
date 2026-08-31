import json
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from domain.answer import Answer, AnswerStatus
from domain.interview import Interview
from domain.question import Question, QuestionType
from domain.topic import TopicEntry, TopicStatus
from infrastructure.db.models import AnswerModel, InterviewModel, QuestionModel
from infrastructure.db.session import get_session_factory
from infrastructure.repositories.base import InterviewRepositoryInterface
from infrastructure.repositories.topic_serialization import (
    serialize_topic_plan as _serialize_topic_plan,
    deserialize_topic_plan as _deserialize_topic_plan,
)


class PostgresInterviewRepository(InterviewRepositoryInterface):
    def __init__(self):
        self._get_session_factory = get_session_factory

    async def save(self, interview: Interview) -> None:
        async with self._get_session_factory()() as session:
            async with session.begin():
                existing = await session.get(InterviewModel, interview.id)

                if existing:
                    existing.user_id = interview.user_id
                    existing.candidate_name = interview.candidate_name
                    existing.job_role = interview.job_role
                    existing.status = interview.status.value
                    existing.resume_id = interview.resume_id
                    existing.resume_snapshot = interview.resume_snapshot
                    existing.jd_snapshot = interview.jd_snapshot
                    existing.current_question_index = interview.current_question_index
                    existing.total_questions = interview.total_questions
                    existing.topic_plan = _serialize_topic_plan(interview.topic_plan)
                    existing.current_topic_id = interview.current_topic_id
                    existing.analysis = json.dumps(interview.analysis) if interview.analysis else None

                    # Batch-load existing question IDs and answer question_ids
                    q_ids = [q.id for q in interview.questions]
                    existing_q_result = await session.execute(
                        select(QuestionModel.id).where(
                            QuestionModel.interview_id == interview.id,
                            QuestionModel.id.in_(q_ids),
                        )
                    )
                    existing_q_ids = {row[0] for row in existing_q_result.all()}

                    a_q_ids = [interview.questions[idx].id for idx in interview.answers if idx < len(interview.questions)]
                    existing_a_result = await session.execute(
                        select(AnswerModel.question_id).where(
                            AnswerModel.interview_id == interview.id,
                            AnswerModel.question_id.in_(a_q_ids),
                        )
                    )
                    existing_a_q_ids = {row[0] for row in existing_a_result.all()}

                    # Insert new questions
                    for q in interview.questions:
                        if q.id not in existing_q_ids:
                            session.add(
                                QuestionModel(
                                    id=q.id,
                                    interview_id=interview.id,
                                    question_text=q.text,
                                    question_index=q.order,
                                    question_type=q.question_type.value,
                                )
                            )

                    # Insert/update answers
                    for idx, a in interview.answers.items():
                        if idx < len(interview.questions):
                            q_id = interview.questions[idx].id
                            if q_id in existing_a_q_ids:
                                # Update existing answer
                                a_row_result = await session.execute(
                                    select(AnswerModel).where(
                                        AnswerModel.interview_id == interview.id,
                                        AnswerModel.question_id == q_id,
                                    )
                                )
                                a_row = a_row_result.scalar_one()
                                a_row.transcript = a.transcript
                                a_row.answer_status = a.answer_status.value if a.answer_status else None
                            else:
                                session.add(
                                    AnswerModel(
                                        interview_id=interview.id,
                                        question_id=q_id,
                                        transcript=a.transcript,
                                        answer_status=a.answer_status.value if a.answer_status else None,
                                    )
                                )
                else:
                    db_interview = InterviewModel(
                        id=interview.id,
                        user_id=interview.user_id,
                        candidate_name=interview.candidate_name,
                        job_role=interview.job_role,
                        status=interview.status.value,
                        resume_id=interview.resume_id,
                        resume_snapshot=interview.resume_snapshot,
                        jd_snapshot=interview.jd_snapshot,
                        current_question_index=interview.current_question_index,
                        total_questions=interview.total_questions,
                        topic_plan=_serialize_topic_plan(interview.topic_plan),
                        current_topic_id=interview.current_topic_id,
                        analysis=json.dumps(interview.analysis) if interview.analysis else None,
                    )
                    session.add(db_interview)

                    for q in interview.questions:
                        session.add(
                            QuestionModel(
                                id=q.id,
                                interview_id=interview.id,
                                question_text=q.text,
                                question_index=q.order,
                                question_type=q.question_type.value,
                            )
                        )

                    for idx, a in interview.answers.items():
                        if idx < len(interview.questions):
                            session.add(
                                AnswerModel(
                                    interview_id=interview.id,
                                    question_id=interview.questions[idx].id,
                                    transcript=a.transcript,
                                    answer_status=a.answer_status.value if a.answer_status else None,
                                )
                            )

    async def get(self, interview_id: UUID) -> Interview | None:
        async with self._get_session_factory()() as session:
            result = await session.execute(
                select(InterviewModel)
                .where(InterviewModel.id == interview_id)
                .options(
                    selectinload(InterviewModel.questions),
                    selectinload(InterviewModel.answers),
                )
            )
            db_interview = result.scalar_one_or_none()

            if not db_interview:
                return None

            return self._to_domain(db_interview)

    async def list_all(self) -> list[Interview]:
        async with self._get_session_factory()() as session:
            result = await session.execute(
                select(InterviewModel).options(
                    selectinload(InterviewModel.questions),
                    selectinload(InterviewModel.answers),
                )
            )
            db_interviews = result.scalars().all()
            return [self._to_domain(i) for i in db_interviews]

    async def delete(self, interview_id: UUID) -> bool:
        async with self._get_session_factory()() as session:
            async with session.begin():
                db_interview = await session.get(InterviewModel, interview_id)
                if not db_interview:
                    return False
                await session.delete(db_interview)
                return True

    def _to_domain(self, db_interview: InterviewModel) -> Interview:
        from domain.interview_state import InterviewState

        questions = sorted(db_interview.questions, key=lambda q: q.question_index)
        domain_questions = [
            Question(
                id=q.id,
                text=q.question_text,
                question_type=QuestionType(q.question_type),
                order=q.question_index,
            )
            for q in questions
        ]

        answers_dict: dict[int, Answer] = {}
        q_id_to_index = {q.id: q.question_index for q in questions}
        for a in db_interview.answers:
            if a.question_id in q_id_to_index:
                idx = q_id_to_index[a.question_id]
                answers_dict[idx] = Answer(
                    question_id=a.question_id,
                    transcript=a.transcript,
                    answer_status=AnswerStatus(a.answer_status) if a.answer_status else None,
                )

        topic_plan = _deserialize_topic_plan(db_interview.topic_plan) if db_interview.topic_plan else []

        return Interview(
            id=db_interview.id,
            user_id=db_interview.user_id,
            candidate_name=db_interview.candidate_name,
            job_role=db_interview.job_role,
            status=InterviewState(db_interview.status),
            resume_id=db_interview.resume_id,
            resume_snapshot=db_interview.resume_snapshot or "",
            jd_snapshot=db_interview.jd_snapshot or "",
            questions=domain_questions,
            answers=answers_dict,
            current_question_index=db_interview.current_question_index,
            total_questions=db_interview.total_questions,
            topic_plan=topic_plan,
            current_topic_id=db_interview.current_topic_id,
            analysis=json.loads(db_interview.analysis) if db_interview.analysis else None,
        )
