from dataclasses import dataclass, field
from uuid import UUID, uuid4

from domain.question import Question
from domain.answer import Answer
from domain.interview_state import InterviewState
from domain.topic import TopicEntry


@dataclass
class Interview:
    id: UUID = field(default_factory=uuid4)
    candidate_name: str = ""
    job_role: str = ""
    status: InterviewState = field(default_factory=lambda: InterviewState.CREATED)
    questions: list[Question] = field(default_factory=list)
    answers: dict[int, Answer] = field(default_factory=dict)
    current_question_index: int = 0
    total_questions: int = 10
    topic_plan: list[TopicEntry] = field(default_factory=list)
    current_topic_id: str | None = None
    analysis: dict | None = None

    @property
    def answered_count(self) -> int:
        return len(self.answers)

    @property
    def is_complete(self) -> bool:
        return self.status == InterviewState.COMPLETED

    def current_question(self) -> Question | None:
        if self.current_question_index < len(self.questions):
            return self.questions[self.current_question_index]
        return None

    def submit_answer(self, answer: Answer) -> None:
        self.answers[self.current_question_index] = answer
        self.status = self.status.next()

    def advance(self) -> None:
        if self.current_question_index < len(self.questions) - 1:
            self.current_question_index += 1
            self.status = self.status.next()  # EVALUATING -> NEXT_QUESTION
            self.status = self.status.next()  # NEXT_QUESTION -> WAITING_FOR_ANSWER
        else:
            self.status = InterviewState.COMPLETED
