from uuid import UUID

from domain.interview import Interview
from domain.question import Question, QuestionType
from domain.answer import Answer
from domain.interview_state import InterviewState
from infrastructure.repositories.base import InterviewRepositoryInterface
from application.llm_service import LLMService
from application.rag_client import RAGClient
from application.question_planner import QuestionPlanner, InterviewContext


class InterviewService:
    def __init__(
        self,
        repository: InterviewRepositoryInterface,
        llm_service: LLMService,
        rag_client: RAGClient,
        planner: QuestionPlanner,
    ):
        self._repository = repository
        self._llm = llm_service
        self._rag = rag_client
        self._planner = planner

    async def start_interview(
        self,
        candidate_name: str,
        job_role: str,
        resume_text: str,
        jd_text: str,
        total_questions: int = 10,
    ) -> Interview:
        interview = Interview(
            candidate_name=candidate_name,
            job_role=job_role,
            total_questions=total_questions,
        )

        # Ingest resume + JD into RAG service
        await self._rag.ingest_documents(
            resume_text=resume_text,
            jd_text=jd_text,
            interview_id=str(interview.id),
        )

        # Derive search angles from job_role for PRIMARY questions
        topics = [
            job_role,
            f"{job_role} experience",
            "resume skills",
            "resume projects",
            "system design",
            "databases",
            "architecture",
            "technical challenges",
            "code quality",
            "scalability",
        ]
        interview.topics = topics[:total_questions]

        # Generate first question (HR intro)
        context = InterviewContext(
            interview_id=str(interview.id),
            job_role=job_role,
            candidate_name=candidate_name,
            questions_asked=0,
            total_questions=total_questions,
            previous_qa=[],
            topics_remaining=list(interview.topics),
            topics_covered=[],
            current_question_type=None,
            follow_up_depth=0,
        )

        question_text, q_type, topic_label = await self._planner.generate_next_question(context)

        interview.questions.append(
            Question(text=question_text, question_type=q_type, order=0)
        )

        if topic_label and topic_label in interview.topics:
            interview.topics.remove(topic_label)
            interview.topics_covered.append(topic_label)

        interview.status = interview.status.next()  # CREATED -> IN_PROGRESS
        interview.status = interview.status.next()  # IN_PROGRESS -> WAITING_FOR_ANSWER
        await self._repository.save(interview)
        return interview

    async def get_interview(self, interview_id: UUID) -> Interview | None:
        return await self._repository.get(interview_id)

    async def submit_answer(self, interview_id: UUID, transcript: str) -> dict | None:
        interview = await self._repository.get(interview_id)
        if not interview:
            return None
        if not interview.status.can_accept_answer():
            return None

        answer = Answer(transcript=transcript)
        interview.submit_answer(answer)

        if len(interview.questions) < interview.total_questions:
            # Build previous Q&A
            previous_qa = []
            for i, question in enumerate(interview.questions):
                prev_answer = interview.answers.get(i)
                if prev_answer:
                    previous_qa.append({
                        "question": question.text,
                        "answer": prev_answer.transcript,
                        "question_type": question.question_type.value,
                    })

            # Calculate follow-up depth
            follow_up_depth = 0
            for qa in reversed(previous_qa):
                if qa["question_type"] == QuestionType.FOLLOW_UP.value:
                    follow_up_depth += 1
                else:
                    break

            # Determine current question type (the one just answered)
            current_q_type = interview.questions[-1].question_type if interview.questions else None

            context = InterviewContext(
                interview_id=str(interview.id),
                job_role=interview.job_role,
                candidate_name=interview.candidate_name,
                questions_asked=len(interview.questions),
                total_questions=interview.total_questions,
                previous_qa=previous_qa,
                topics_remaining=list(interview.topics),
                topics_covered=list(interview.topics_covered),
                current_question_type=current_q_type,
                follow_up_depth=follow_up_depth,
            )

            question_text, q_type, topic_label = await self._planner.generate_next_question(context)

            new_index = len(interview.questions)
            interview.questions.append(
                Question(text=question_text, question_type=q_type, order=new_index)
            )

            if topic_label and topic_label in interview.topics:
                interview.topics.remove(topic_label)
                interview.topics_covered.append(topic_label)

            interview.advance()
        else:
            interview.status = InterviewState.COMPLETED

        await self._repository.save(interview)

        is_complete = interview.status == InterviewState.COMPLETED
        q = interview.current_question()
        return {
            "interview_id": str(interview.id),
            "question_index": interview.current_question_index if not is_complete else None,
            "answered_count": interview.answered_count,
            "status": interview.status.value,
            "next_question": None if is_complete else (q.text if q else None),
            "next_question_index": interview.current_question_index if not is_complete else None,
            "total_questions": interview.total_questions,
        }

    async def get_results(self, interview_id: UUID) -> dict | None:
        interview = await self._repository.get(interview_id)
        if not interview:
            return None

        results = []
        for i, question in enumerate(interview.questions):
            answer = interview.answers.get(i)
            results.append(
                {
                    "question_index": i,
                    "question": question.text,
                    "answer": answer.transcript if answer else "(no answer captured)",
                }
            )

        return {
            "interview_id": str(interview.id),
            "status": interview.status.value,
            "results": results,
        }
