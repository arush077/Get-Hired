export const InterviewState = Object.freeze({
  CREATED: "CREATED",
  IN_PROGRESS: "IN_PROGRESS",
  WAITING_FOR_ANSWER: "WAITING_FOR_ANSWER",
  EVALUATING: "EVALUATING",
  NEXT_QUESTION: "NEXT_QUESTION",
  COMPLETED: "COMPLETED",
});

const TRANSITIONS = {
  [InterviewState.CREATED]: InterviewState.IN_PROGRESS,
  [InterviewState.IN_PROGRESS]: InterviewState.WAITING_FOR_ANSWER,
  [InterviewState.WAITING_FOR_ANSWER]: InterviewState.EVALUATING,
  [InterviewState.EVALUATING]: InterviewState.NEXT_QUESTION,
  [InterviewState.NEXT_QUESTION]: InterviewState.WAITING_FOR_ANSWER,
  [InterviewState.COMPLETED]: InterviewState.COMPLETED,
};

export function nextState(current) {
  return TRANSITIONS[current] ?? InterviewState.COMPLETED;
}

export function canAcceptAnswer(state) {
  return state === InterviewState.WAITING_FOR_ANSWER;
}
