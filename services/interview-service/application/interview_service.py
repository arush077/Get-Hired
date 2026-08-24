from uuid import UUID

from domain.interview import Interview
from domain.question import Question
from domain.answer import Answer
from domain.interview_state import InterviewState
from infrastructure.repositories.base import InterviewRepositoryInterface
from application.llm_service import LLMService
from application.rag_client import RAGClient

MAX_QUESTIONS = 6


class InterviewService:
    def __init__(
        self,
        repository: InterviewRepositoryInterface,
        llm_service: LLMService,
        rag_client: RAGClient,
    ):
        self._repository = repository
        self._llm = llm_service
        self._rag = rag_client

    async def start_interview(
        self, candidate_name: str, job_role: str, resume_text: str, jd_text: str
    ) -> Interview:
        interview = Interview(candidate_name=candidate_name, job_role=job_role)

        # Ingest resume + JD into RAG service and link to this interview
        await self._rag.ingest_documents(
            resume_text=resume_text,
            jd_text=jd_text,
            interview_id=str(interview.id),
        )

        # Generate first question using LLM
        resume_summary = resume_text[:500]
        first_question_text = self._llm.generate_first_question(
            job_role=job_role,
            resume_summary=resume_summary,
        )

        interview.questions.append(Question(text=first_question_text, order=0))
        interview.status = interview.status.next()  # CREATED → IN_PROGRESS
        interview.status = interview.status.next()  # IN_PROGRESS → WAITING_FOR_ANSWER
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

        # If we haven't hit the question limit, generate a cross-question
        if len(interview.questions) < MAX_QUESTIONS:
            context_chunks = await self._rag.retrieve_context(
                query=transcript,
                interview_id=str(interview_id),
                top_k=3,
            )

            previous_qa = []
            for i, question in enumerate(interview.questions[:-1]):
                prev_answer = interview.answers.get(i)
                if prev_answer:
                    previous_qa.append({
                        "question": question.text,
                        "answer": prev_answer.transcript,
                    })

            cross_question_text = self._llm.generate_cross_question(
                job_role=interview.job_role,
                previous_qa=previous_qa,
                current_answer=transcript,
                context_chunks=context_chunks,
            )

            new_index = len(interview.questions)
            interview.questions.append(Question(text=cross_question_text, order=new_index))
            interview.advance()
        else:
            interview.status = InterviewState.COMPLETED

        await self._repository.save(interview)

        q = interview.current_question()
        return {
            "interview_id": str(interview.id),
            "question_index": interview.current_question_index,
            "answered_count": interview.answered_count,
            "status": interview.status.value,
            "next_question": q.text if q else None,
            "next_question_index": interview.current_question_index,
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
