from enum import Enum


class InterviewState(Enum):
    CREATED = "CREATED"
    IN_PROGRESS = "IN_PROGRESS"
    WAITING_FOR_ANSWER = "WAITING_FOR_ANSWER"
    EVALUATING = "EVALUATING"
    NEXT_QUESTION = "NEXT_QUESTION"
    COMPLETED = "COMPLETED"

    def can_accept_answer(self) -> bool:
        return self == InterviewState.WAITING_FOR_ANSWER

    def next(self) -> "InterviewState":
        transitions = {
            InterviewState.CREATED: InterviewState.IN_PROGRESS,
            InterviewState.IN_PROGRESS: InterviewState.WAITING_FOR_ANSWER,
            InterviewState.WAITING_FOR_ANSWER: InterviewState.EVALUATING,
            InterviewState.EVALUATING: InterviewState.NEXT_QUESTION,
            InterviewState.NEXT_QUESTION: InterviewState.WAITING_FOR_ANSWER,
        }
        return transitions.get(self, InterviewState.COMPLETED)
