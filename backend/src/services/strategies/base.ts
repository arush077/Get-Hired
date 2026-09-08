export interface InterviewStrategy {
  getInitialPlanningInstructions(): string;
  getRuntimeInstructions(): string;
  getEvaluationInstructions(): string;
}
