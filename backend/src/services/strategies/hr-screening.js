export class HRScreeningStrategy {
  getInitialPlanningInstructions() {
    return (
      "Interview mode: HR Screening.\n\n" +
      "Simulate an initial recruiter-style conversation.\n\n" +
      "Focus on:\n" +
      "- tell me about yourself\n" +
      "- motivation for software engineering\n" +
      "- motivation for the role\n" +
      "- interest in the company when company information is available\n" +
      "- career goals\n" +
      "- strengths\n" +
      "- areas for improvement\n" +
      "- preferred working environment\n" +
      "- expectations\n" +
      "- general role fit\n\n" +
      "Keep questions:\n" +
      "- conversational\n" +
      "- concise\n" +
      "- accessible when spoken aloud\n\n" +
      "Avoid deep technical implementation questions.\n\n" +
      "Do not invent or assume personal information.\n\n" +
      "Do not ask for salary expectations, notice period, relocation, visa status, " +
      "availability, or other personal details unless explicitly provided as interview inputs.\n\n" +
      "Example style:\n" +
      '"What interests you about this role, and how does it fit into what you want ' +
      'to work on next?"'
    );
  }

  getRuntimeInstructions() {
    return (
      "INTERVIEW MODE: HR Screening.\n\n" +
      "Keep follow-ups conversational and focused on:\n" +
      "- motivation\n" +
      "- fit\n" +
      "- career goals\n" +
      "- communication\n" +
      "- role expectations\n\n" +
      "Avoid turning the interview into a technical deep dive."
    );
  }

  getEvaluationInstructions() {
    return (
      "### HR_SCREENING\n" +
      "Focus on:\n" +
      "- communication\n" +
      "- motivation\n" +
      "- role fit\n" +
      "- self-awareness\n" +
      "- career goals\n" +
      "- expectations\n\n" +
      "Do not penalize lack of technical depth."
    );
  }
}
