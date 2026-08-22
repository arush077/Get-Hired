from uuid import UUID

from domain.interview import Interview
from domain.question import Question
from domain.answer import Answer
from infrastructure.repositories.interview_repository import InterviewRepository

HARDCODED_QUESTIONS = [
    "Tell me about yourself and your background.",
    "Describe a challenging project you worked on recently. What made it difficult?",
    "Where do you see yourself professionally in the next three years?",
]


class InterviewService:
    def __init__(self, repository: InterviewRepository):
        self._repository = repository

    def start_interview(self, candidate_name: str, job_role: str) -> Interview:
        interview = Interview(candidate_name=candidate_name, job_role=job_role)

        for i, text in enumerate(HARDCODED_QUESTIONS):
            interview.questions.append(Question(text=text, order=i))

        interview.status = interview.status.next()
        self._repository.save(interview)
        return interview

    def get_interview(self, interview_id: UUID) -> Interview | None:
        return self._repository.get(interview_id)

    def submit_answer(self, interview_id: UUID, transcript: str) -> dict | None:
        interview = self._repository.get(interview_id)
        if not interview:
            return None
        if not interview.status.can_accept_answer():
            return None

        answer = Answer(transcript=transcript)
        interview.submit_answer(answer)

        has_next = interview.current_question_index < interview.total_questions - 1
        if has_next:
            interview.advance()

        self._repository.save(interview)

        result = {
            "interview_id": str(interview.id),
            "question_index": interview.current_question_index,
            "answered_count": interview.answered_count,
            "status": interview.status.value,
        }

        if has_next:
            q = interview.current_question()
            result["next_question"] = q.text if q else None
            result["next_question_index"] = interview.current_question_index
        else:
            result["next_question"] = None
            result["next_question_index"] = None

        return result

    def get_results(self, interview_id: UUID) -> dict | None:
        interview = self._repository.get(interview_id)
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
