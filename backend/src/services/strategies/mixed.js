export class MixedInterviewStrategy {
  getInitialPlanningInstructions() {
    return (
      "Interview mode: Mixed Interview.\n\n" +
      "Create a realistic end-to-end software engineering interview combining:\n" +
      "- Resume / work experience\n" +
      "- Technical skills\n" +
      "- HR / motivation\n\n" +
      "For a 10-question interview, aim approximately for:\n" +
      "- 5 Resume / Experience questions\n" +
      "- 3 Technical questions\n" +
      "- 2 HR questions\n\n" +
      "Maintain reasonable distribution instead of clustering all questions in one category.\n\n" +
      "Resume questions must preserve project and experience boundaries.\n\n" +
      "Technical questions should probe depth on skills mentioned in the Resume and JD.\n\n" +
      "HR questions should remain conversational.\n\n" +
      "Do not create DSA/coding questions requiring a code editor.\n\n" +
      "The interview should feel like one realistic interview rather than unrelated " +
      "question categories.\n\n" +
      "Example topic types:\n" +
      'Resume: "Tell me about the biggest technical challenge you faced in MergePilot."\n' +
      'Technical: "How does your caching layer handle cache invalidation under high write throughput?"\n' +
      'HR: "What are you looking for in your next role?"'
    );
  }

  getRuntimeInstructions() {
    return (
      "INTERVIEW MODE: Mixed Interview.\n\n" +
      "Respect the category of the current question:\n" +
      "- Resume question: stay focused on the candidate's experience.\n" +
      "- Technical question: stay focused on implementation depth and trade-offs.\n" +
      "- HR question: stay conversational.\n\n" +
      "Maintain the intended mixed interview balance."
    );
  }

  getEvaluationInstructions() {
    return (
      "### MIXED\n" +
      "Evaluate technical, resume, and HR answers according to their question type.\n" +
      "Balance technical depth, correctness, specificity, clarity, and communication."
    );
  }
}
