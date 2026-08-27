import json
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from domain.answer import Answer, AnswerStatus
from domain.interview import Interview
from domain.question import Question, QuestionType
from infrastructure.db.models import AnswerModel, InterviewModel, QuestionModel
from infrastructure.db.session import async_session_factory
from infrastructure.repositories.base import InterviewRepositoryInterface


class PostgresInterviewRepository(InterviewRepositoryInterface):
    def __init__(self):
        self._session_factory = async_session_factory

    async def save(self, interview: Interview) -> None:
        async with self._session_factory() as session:
            async with session.begin():
                existing = await session.get(InterviewModel, interview.id)

                if existing:
                    existing.candidate_name = interview.candidate_name
                    existing.job_role = interview.job_role
                    existing.status = interview.status.value
                    existing.current_question_index = interview.current_question_index
                    existing.total_questions = interview.total_questions
                    existing.topics = json.dumps(interview.topics)
                    existing.topics_covered = json.dumps(interview.topics_covered)
                    existing.topic_status = json.dumps(interview.topic_status)
                    existing.questions_per_topic = json.dumps(interview.questions_per_topic)
                    existing.analysis = json.dumps(interview.analysis) if interview.analysis else None

                    for q in interview.questions:
                        q_exists = await session.get(QuestionModel, q.id)
                        if not q_exists:
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
                            q_id = interview.questions[idx].id
                            a_exists = await session.execute(
                                select(AnswerModel).where(
                                    AnswerModel.interview_id == interview.id,
                                    AnswerModel.question_id == q_id,
                                )
                            )
                            a_row = a_exists.scalar_one_or_none()
                            if a_row:
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
                        candidate_name=interview.candidate_name,
                        job_role=interview.job_role,
                        status=interview.status.value,
                        current_question_index=interview.current_question_index,
                        total_questions=interview.total_questions,
                        topics=json.dumps(interview.topics),
                        topics_covered=json.dumps(interview.topics_covered),
                        topic_status=json.dumps(interview.topic_status),
                        questions_per_topic=json.dumps(interview.questions_per_topic),
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
        async with self._session_factory() as session:
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
        async with self._session_factory() as session:
            result = await session.execute(
                select(InterviewModel).options(
                    selectinload(InterviewModel.questions),
                    selectinload(InterviewModel.answers),
                )
            )
            db_interviews = result.scalars().all()
            return [self._to_domain(i) for i in db_interviews]

    async def delete(self, interview_id: UUID) -> bool:
        async with self._session_factory() as session:
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

        return Interview(
            id=db_interview.id,
            candidate_name=db_interview.candidate_name,
            job_role=db_interview.job_role,
            status=InterviewState(db_interview.status),
            questions=domain_questions,
            answers=answers_dict,
            current_question_index=db_interview.current_question_index,
            total_questions=db_interview.total_questions,
            topics=json.loads(db_interview.topics),
            topics_covered=json.loads(db_interview.topics_covered),
            topic_status=json.loads(db_interview.topic_status),
            questions_per_topic=json.loads(db_interview.questions_per_topic),
            analysis=json.loads(db_interview.analysis) if db_interview.analysis else None,
        )
