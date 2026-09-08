import { describe, it, expect } from "vitest";
import {
  Interview,
  InterviewState,
  InterviewMode,
  Question,
  Answer,
  AnswerStatus,
  QuestionType,
  TopicEntry,
  TopicStatus,
  AnalysisStatus,
  nextState,
  canAcceptAnswer,
} from "../../src/models/index.js";

// ── State machine tests ─────────────────────────────────────────

describe("InterviewState transitions", () => {
  it("CREATED -> IN_PROGRESS", () => {
    expect(nextState(InterviewState.CREATED)).toBe(InterviewState.IN_PROGRESS);
  });

  it("IN_PROGRESS -> WAITING_FOR_ANSWER", () => {
    expect(nextState(InterviewState.IN_PROGRESS)).toBe(InterviewState.WAITING_FOR_ANSWER);
  });

  it("WAITING_FOR_ANSWER -> EVALUATING", () => {
    expect(nextState(InterviewState.WAITING_FOR_ANSWER)).toBe(InterviewState.EVALUATING);
  });

  it("EVALUATING -> NEXT_QUESTION", () => {
    expect(nextState(InterviewState.EVALUATING)).toBe(InterviewState.NEXT_QUESTION);
  });

  it("NEXT_QUESTION -> WAITING_FOR_ANSWER", () => {
    expect(nextState(InterviewState.NEXT_QUESTION)).toBe(InterviewState.WAITING_FOR_ANSWER);
  });

  it("COMPLETED -> COMPLETED (terminal)", () => {
    expect(nextState(InterviewState.COMPLETED)).toBe(InterviewState.COMPLETED);
  });

  it("canAcceptAnswer only for WAITING_FOR_ANSWER", () => {
    expect(canAcceptAnswer(InterviewState.WAITING_FOR_ANSWER)).toBe(true);
    expect(canAcceptAnswer(InterviewState.CREATED)).toBe(false);
    expect(canAcceptAnswer(InterviewState.IN_PROGRESS)).toBe(false);
    expect(canAcceptAnswer(InterviewState.EVALUATING)).toBe(false);
    expect(canAcceptAnswer(InterviewState.NEXT_QUESTION)).toBe(false);
    expect(canAcceptAnswer(InterviewState.COMPLETED)).toBe(false);
  });
});

// ── Interview class tests ───────────────────────────────────────

describe("Interview", () => {
  function makeInterview(numQuestions = 3): Interview {
    const questions = Array.from({ length: numQuestions }, (_, i) =>
      new Question({
        text: `Question ${i + 1}?`,
        questionType: i === 0 ? QuestionType.HR : QuestionType.PRIMARY,
        order: i,
      }),
    );
    return new Interview({
      candidateName: "Test",
      jobRole: "SDE-1",
      totalQuestions: numQuestions,
      questions,
      status: InterviewState.WAITING_FOR_ANSWER,
    });
  }

  it("starts with correct defaults", () => {
    const interview = new Interview();
    expect(interview.status).toBe(InterviewState.CREATED);
    expect(interview.interviewMode).toBe(InterviewMode.MIXED);
    expect(interview.totalQuestions).toBe(10);
    expect(interview.answeredCount).toBe(0);
    expect(interview.isComplete).toBe(false);
  });

  it("answeredCount returns number of answers", () => {
    const interview = makeInterview(3);
    expect(interview.answeredCount).toBe(0);

    interview.submitAnswer(new Answer({ transcript: "A1" }));
    expect(interview.answeredCount).toBe(1);

    interview.advance();
    interview.submitAnswer(new Answer({ transcript: "A2" }));
    expect(interview.answeredCount).toBe(2);
  });

  it("isComplete reflects COMPLETED status", () => {
    const interview = makeInterview();
    expect(interview.isComplete).toBe(false);

    interview.status = InterviewState.COMPLETED;
    expect(interview.isComplete).toBe(true);
  });

  it("currentQuestion returns question at current index", () => {
    const interview = makeInterview(3);
    const q = interview.currentQuestion();
    expect(q).not.toBeNull();
    expect(q!.text).toBe("Question 1?");
    expect(q!.order).toBe(0);
  });

  it("currentQuestion returns null when index out of bounds", () => {
    const interview = makeInterview(2);
    interview.currentQuestionIndex = 5;
    expect(interview.currentQuestion()).toBeNull();
  });
});

// ── submitAnswer tests ──────────────────────────────────────────

describe("Interview.submitAnswer", () => {
  function makeInterview(): Interview {
    return new Interview({
      candidateName: "Test",
      jobRole: "SDE-1",
      totalQuestions: 3,
      questions: [
        new Question({ text: "Q1?", order: 0 }),
        new Question({ text: "Q2?", order: 1 }),
        new Question({ text: "Q3?", order: 2 }),
      ],
      status: InterviewState.WAITING_FOR_ANSWER,
    });
  }

  it("stores answer at current question index", () => {
    const interview = makeInterview();
    const answer = new Answer({ transcript: "My answer" });

    interview.submitAnswer(answer);

    expect(interview.answers[0]).toBe(answer);
    expect(interview.answers[0].transcript).toBe("My answer");
  });

  it("transitions from WAITING_FOR_ANSWER to EVALUATING", () => {
    const interview = makeInterview();
    expect(interview.status).toBe(InterviewState.WAITING_FOR_ANSWER);

    interview.submitAnswer(new Answer({ transcript: "A1" }));

    expect(interview.status).toBe(InterviewState.EVALUATING);
  });

  it("does not advance question index", () => {
    const interview = makeInterview();
    interview.submitAnswer(new Answer({ transcript: "A1" }));
    expect(interview.currentQuestionIndex).toBe(0);
  });
});

// ── advance() tests — the critical double-transition ────────────

describe("Interview.advance", () => {
  function makeInterview(numQuestions = 3): Interview {
    return new Interview({
      candidateName: "Test",
      jobRole: "SDE-1",
      totalQuestions: numQuestions,
      questions: Array.from({ length: numQuestions }, (_, i) =>
        new Question({ text: `Q${i + 1}?`, order: i }),
      ),
      status: InterviewState.EVALUATING,
    });
  }

  it("increments question index", () => {
    const interview = makeInterview();
    expect(interview.currentQuestionIndex).toBe(0);

    interview.advance();

    expect(interview.currentQuestionIndex).toBe(1);
  });

  it("performs double transition: EVALUATING -> NEXT_QUESTION -> WAITING_FOR_ANSWER", () => {
    const interview = makeInterview();
    interview.status = InterviewState.EVALUATING;

    interview.advance();

    // After advance, status should be WAITING_FOR_ANSWER (not NEXT_QUESTION)
    expect(interview.status).toBe(InterviewState.WAITING_FOR_ANSWER);
  });

  it("does NOT stop at NEXT_QUESTION", () => {
    const interview = makeInterview();
    interview.status = InterviewState.EVALUATING;

    interview.advance();

    // This is the critical assertion — status must NOT be NEXT_QUESTION
    expect(interview.status).not.toBe(InterviewState.NEXT_QUESTION);
  });

  it("transitions to COMPLETED when at last question", () => {
    const interview = makeInterview(2);
    interview.currentQuestionIndex = 1; // at last question
    interview.status = InterviewState.EVALUATING;

    interview.advance();

    expect(interview.status).toBe(InterviewState.COMPLETED);
    expect(interview.currentQuestionIndex).toBe(1); // index doesn't change
  });

  it("can chain submitAnswer -> advance -> submitAnswer correctly", () => {
    const interview = makeInterview(3);
    // Status starts at WAITING_FOR_ANSWER (set in makeInterview... actually let me set it)
    interview.status = InterviewState.WAITING_FOR_ANSWER;

    // Q1
    interview.submitAnswer(new Answer({ transcript: "A1" }));
    expect(interview.status).toBe(InterviewState.EVALUATING);
    expect(interview.currentQuestionIndex).toBe(0);

    interview.advance();
    expect(interview.status).toBe(InterviewState.WAITING_FOR_ANSWER);
    expect(interview.currentQuestionIndex).toBe(1);

    // Q2
    interview.submitAnswer(new Answer({ transcript: "A2" }));
    expect(interview.status).toBe(InterviewState.EVALUATING);

    interview.advance();
    expect(interview.status).toBe(InterviewState.WAITING_FOR_ANSWER);
    expect(interview.currentQuestionIndex).toBe(2);

    // Q3 (last)
    interview.submitAnswer(new Answer({ transcript: "A3" }));
    expect(interview.status).toBe(InterviewState.EVALUATING);

    interview.advance();
    expect(interview.status).toBe(InterviewState.COMPLETED);
    expect(interview.answeredCount).toBe(3);
  });
});

// ── TopicEntry tests ────────────────────────────────────────────

describe("TopicEntry", () => {
  it("defaults to AVAILABLE status", () => {
    const topic = new TopicEntry({
      id: "t1",
      label: "Test",
      source: "Source",
      primaryQuestion: "Q?",
      priority: 1,
    });
    expect(topic.status).toBe(TopicStatus.AVAILABLE);
    expect(topic.questionsAsked).toBe(0);
    expect(topic.exhaustionReason).toBeNull();
  });

  it("allows mutation of status and questionsAsked", () => {
    const topic = new TopicEntry({
      id: "t1",
      label: "Test",
      source: "Source",
      primaryQuestion: "Q?",
      priority: 1,
    });
    topic.status = TopicStatus.EXHAUSTED;
    topic.exhaustionReason = "DOES_NOT_KNOW";
    topic.questionsAsked = 2;

    expect(topic.status).toBe(TopicStatus.EXHAUSTED);
    expect(topic.exhaustionReason).toBe("DOES_NOT_KNOW");
    expect(topic.questionsAsked).toBe(2);
  });
});

// ── Resume.toText() tests ───────────────────────────────────────

describe("Resume.toText", () => {
  it("reconstructs plain text from structured resume", async () => {
    const { Resume, ResumeEducation, ResumeExperience, ResumeProject } = await import(
      "../../src/models/resume.js"
    );

    const resume = new Resume({
      personalInfo: {
        fullName: "John Doe",
        email: "john@example.com",
        phone: "555-1234",
        linkedin: "linkedin.com/in/johndoe",
        github: "github.com/johndoe",
      },
      education: [
        new ResumeEducation({
          college: "MIT",
          degree: "B.S. Computer Science",
          cgpa: "3.8",
          startYear: "2018",
          endYear: "2022",
        }),
      ],
      experience: [
        new ResumeExperience({
          company: "Google",
          role: "Software Engineer",
          description: "Built search features.",
        }),
      ],
      projects: [
        new ResumeProject({
          name: "GetHired",
          technologies: "React, Node.js",
          description: "Interview prep platform.",
        }),
      ],
      skills: "TypeScript, Python, React",
    });

    const text = resume.toText();

    expect(text).toContain("Name: John Doe");
    expect(text).toContain("Email: john@example.com");
    expect(text).toContain("Phone: 555-1234");
    expect(text).toContain("LinkedIn: linkedin.com/in/johndoe");
    expect(text).toContain("GitHub: github.com/johndoe");
    expect(text).toContain("Education:");
    expect(text).toContain("- B.S. Computer Science at MIT, CGPA: 3.8 (2018 - 2022)");
    expect(text).toContain("Experience:");
    expect(text).toContain("- Software Engineer at Google");
    expect(text).toContain("  Built search features.");
    expect(text).toContain("Projects:");
    expect(text).toContain("- GetHired (React, Node.js)");
    expect(text).toContain("  Interview prep platform.");
    expect(text).toContain("Skills: TypeScript, Python, React");
  });

  it("skips empty fields", async () => {
    const { Resume } = await import("../../src/models/resume.js");

    const resume = new Resume({
      personalInfo: { fullName: "Jane" },
      skills: "Python",
    });

    const text = resume.toText();

    expect(text).toContain("Name: Jane");
    expect(text).not.toContain("Email:");
    expect(text).not.toContain("Phone:");
    expect(text).not.toContain("Education:");
    expect(text).not.toContain("Experience:");
    expect(text).not.toContain("Projects:");
    expect(text).toContain("Skills: Python");
  });

  it("returns empty string for empty resume", async () => {
    const { Resume } = await import("../../src/models/resume.js");

    const resume = new Resume({
      personalInfo: {},
    });

    const text = resume.toText();
    expect(text).toBe("");
  });
});

// ── Question and Answer tests ───────────────────────────────────

describe("Question", () => {
  it("has correct defaults", () => {
    const q = new Question();
    expect(q.id).toBeTruthy();
    expect(q.text).toBe("");
    expect(q.questionType).toBe(QuestionType.PRIMARY);
    expect(q.order).toBe(0);
  });

  it("accepts custom values", () => {
    const q = new Question({
      text: "Hello?",
      questionType: QuestionType.HR,
      order: 5,
    });
    expect(q.text).toBe("Hello?");
    expect(q.questionType).toBe(QuestionType.HR);
    expect(q.order).toBe(5);
  });
});

describe("Answer", () => {
  it("has correct defaults", () => {
    const a = new Answer();
    expect(a.questionId).toBeTruthy();
    expect(a.transcript).toBe("");
    expect(a.answerStatus).toBeNull();
    expect(a.timestamp).toBeInstanceOf(Date);
  });

  it("accepts custom values", () => {
    const a = new Answer({
      transcript: "My answer",
      answerStatus: AnswerStatus.ANSWERED,
    });
    expect(a.transcript).toBe("My answer");
    expect(a.answerStatus).toBe(AnswerStatus.ANSWERED);
  });
});
