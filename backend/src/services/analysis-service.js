import { Interview } from "../models/interview.js";
import { InterviewStrategyFactory } from "./strategies/factory.js";

export class AnalysisService {
  constructor(llm) {
    this.llm = llm;
  }

  async analyze(interview) {
    const sortedQuestions = [...interview.questions].sort((a, b) => a.order - b.order);

    const topicMap = this.buildTopicMap(interview);

    const questionsMeta = sortedQuestions.map((q, i) => {
      const [topicLabel, topicSource] = topicMap.get(i) || ["", ""];
      return {
        index: i,
        text: q.text,
        type: q.questionType,
        topicLabel,
        topicSource,
      };
    });

    const answersMeta = sortedQuestions.map((q, i) => {
      const answer = interview.answers[i];
      return {
        index: i,
        transcript: answer?.transcript || "(no answer captured)",
        answerStatus: answer?.answerStatus || null,
      };
    });

    const hasAnswer = answersMeta.some((a) => a.transcript.trim() && a.transcript !== "(no answer captured)");
    if (!hasAnswer) {
      return {
        overall_score: 0,
        dimensions: {},
        strengths: [],
        areas_to_improve: [
          "Provide complete, detailed responses to interview questions",
          "Demonstrate technical knowledge and examples in answers",
        ],
        recurring_patterns: [],
        question_feedback: [],
        recommendations: [],
        jd_match: null,
      };
    }

    const strategy = InterviewStrategyFactory.get(interview.interviewMode);

    return this.llm.generateAnalysis({
      resumeText: interview.resumeSnapshot,
      jdText: interview.jdSnapshot,
      jobRole: interview.jobRole,
      questions: questionsMeta,
      answers: answersMeta,
      strategy,
    });
  }

  buildTopicMap(interview) {
    const topicMap = new Map();
    if (!interview.topicPlan.length) return topicMap;

    const sortedTopics = [...interview.topicPlan].sort((a, b) => a.priority - b.priority);
    let qIndex = 0;

    for (const topic of sortedTopics) {
      if (qIndex < interview.questions.length) {
        topicMap.set(qIndex, [topic.label, topic.source]);
        qIndex++;
        const followUps = Math.max(0, (topic.questionsAsked || 0) - 1);
        for (let j = 0; j < followUps; j++) {
          if (qIndex < interview.questions.length) {
            topicMap.set(qIndex, [topic.label, topic.source]);
            qIndex++;
          }
        }
      }
    }

    while (qIndex < interview.questions.length) {
      if (sortedTopics.length > 0) {
        const lastTopic = sortedTopics[sortedTopics.length - 1];
        topicMap.set(qIndex, [lastTopic.label, lastTopic.source]);
      }
      qIndex++;
    }

    return topicMap;
  }
}
