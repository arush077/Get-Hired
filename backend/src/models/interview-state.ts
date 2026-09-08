export enum InterviewState {
  CREATED = "CREATED",
  IN_PROGRESS = "IN_PROGRESS",
  WAITING_FOR_ANSWER = "WAITING_FOR_ANSWER",
  EVALUATING = "EVALUATING",
  NEXT_QUESTION = "NEXT_QUESTION",
  COMPLETED = "COMPLETED",
}

const TRANSITIONS: Record<InterviewState, InterviewState> = {
  [InterviewState.CREATED]: InterviewState.IN_PROGRESS,
  [InterviewState.IN_PROGRESS]: InterviewState.WAITING_FOR_ANSWER,
  [InterviewState.WAITING_FOR_ANSWER]: InterviewState.EVALUATING,
  [InterviewState.EVALUATING]: InterviewState.NEXT_QUESTION,
  [InterviewState.NEXT_QUESTION]: InterviewState.WAITING_FOR_ANSWER,
  [InterviewState.COMPLETED]: InterviewState.COMPLETED,
};

export function nextState(current: InterviewState): InterviewState {
  return TRANSITIONS[current] ?? InterviewState.COMPLETED;
}

export function canAcceptAnswer(state: InterviewState): boolean {
  return state === InterviewState.WAITING_FOR_ANSWER;
}
