export class TechnicalStrategy {
  getInitialPlanningInstructions() {
    return (
      "INTERVIEW MODE: Technical.\n\n" +
      "Prioritize the technical requirements explicitly stated in the Job Description.\n" +
      "The Job Description is the primary source for technical topic selection.\n\n" +
      "Use the candidate's Resume as a secondary source for grounding questions in " +
      "technologies, projects, and engineering experience when that information exists.\n\n" +
      "If a technology/framework/tool is explicitly required or mentioned in the JD " +
      "but is NOT present in the Resume, still create technical questions about it.\n" +
      "Ask conceptual, implementation, architecture, debugging, or design questions " +
      "without claiming that the candidate has prior experience with that technology.\n\n" +
      "Never turn a JD technical requirement into an HR, behavioral, motivation, or " +
      "career-fit question.\n\n" +
      "For example, if the JD mentions React.js and Node.js and the Resume is blank, " +
      "the topic plan must still contain React.js and Node.js-focused technical topics.\n\n" +
      "Prioritize:\n" +
      "- technologies/frameworks explicitly mentioned in the JD\n" +
      "- technical skills demonstrated in the Resume\n" +
      "- APIs and backend architecture\n" +
      "- frontend architecture\n" +
      "- databases and data modeling\n" +
      "- scalability and performance\n" +
      "- debugging and failure handling\n" +
      "- security\n" +
      "- system design and technical trade-offs\n\n" +
      "Do not create generic HR or behavioral topics in Technical mode.\n\n" +
      "Do not invent candidate experience with JD technologies that are absent from " +
      "the Resume."
    );
  }

  getRuntimeInstructions() {
    return (
      "INTERVIEW MODE: Technical.\n\n" +
      "Focus follow-ups on:\n" +
      "- implementation details and internals\n" +
      "- why a specific technology or approach was chosen\n" +
      "- trade-offs and alternatives considered\n" +
      "- edge cases and failure handling\n" +
      "- performance characteristics\n" +
      "- how it connects to the JD requirements\n\n" +
      "Push vague answers like 'I used X' toward concrete technical depth: " +
      "how X works, why X over Y, what broke, and how it was fixed."
    );
  }

  getEvaluationInstructions() {
    return (
      "### TECHNICAL\n" +
      "Focus on:\n" +
      "- technical understanding\n" +
      "- correctness\n" +
      "- implementation details\n" +
      "- architecture\n" +
      "- trade-offs\n" +
      "- edge cases and failure handling\n" +
      "- performance and scalability when relevant\n\n" +
      "Weight technical_depth and correctness more heavily than communication."
    );
  }
}
