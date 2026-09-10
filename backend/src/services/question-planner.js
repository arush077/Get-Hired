import { TopicEntry } from "../models/topic.js";
import { TopicStatus } from "../models/topic-status.js";
import { getLogger } from "../logging/logger.js";

export const MAX_QUESTIONS_PER_TOPIC = 2;
export const DEDUP_THRESHOLD = 0.85;

export class QuestionPlanner {
  constructor() {
    this.askedEmbeddings = [];
  }

  resetEmbeddings() {
    this.askedEmbeddings = [];
  }

  applyHardRules(params) {
    const { classification, topicPlan, currentTopic, questionsAnswered, totalQuestions } = params;
    const { answerStatus, nextAction } = classification;

    if (answerStatus === "NEEDS_CLARIFICATION") {
      return { ...classification, nextAction: "CLARIFY" };
    }

    if (answerStatus === "DOES_NOT_KNOW") {
      if (currentTopic) {
        currentTopic.status = TopicStatus.EXHAUSTED;
        currentTopic.exhaustionReason = "DOES_NOT_KNOW";
      }
      return { ...classification, nextAction: "NEW_TOPIC" };
    }

    if (currentTopic && currentTopic.questionsAsked >= MAX_QUESTIONS_PER_TOPIC) {
      currentTopic.status = TopicStatus.EXHAUSTED;
      currentTopic.exhaustionReason = "MAX_QUESTIONS_REACHED";
      return { ...classification, nextAction: "NEW_TOPIC" };
    }

    const questionsRemaining = totalQuestions - questionsAnswered;
    const unvisited = topicPlan.filter((t) => t.status === TopicStatus.AVAILABLE);
    if (questionsRemaining <= unvisited.length && nextAction === "FOLLOW_UP") {
      return { ...classification, nextAction: "NEW_TOPIC" };
    }

    if (unvisited.length === 0 && nextAction === "FOLLOW_UP") {
      return { ...classification, nextAction: "NEW_TOPIC" };
    }

    return classification;
  }

  selectTopic(topicPlan, suggestedId) {
    const available = new Map();
    for (const t of topicPlan) {
      if (t.status === TopicStatus.AVAILABLE) {
        available.set(t.id, t);
      }
    }

    if (suggestedId && available.has(suggestedId)) {
      return available.get(suggestedId);
    }

    if (available.size > 0) {
      let best = null;
      for (const t of available.values()) {
        if (!best || t.priority < best.priority) {
          best = t;
        }
      }
      return best;
    }

    return null;
  }

  async dedupAndCacheQuestion(questionText, embedFn) {
    const newEmb = await this.embedQuestion(questionText, embedFn);

    if (newEmb && this.isDuplicate(newEmb)) {
      getLogger().warn("[PLANNER] Duplicate question detected, but using it as fallback");
    }

    if (newEmb) {
      this.askedEmbeddings.push(newEmb);
    }

    return newEmb;
  }

  async embedQuestion(questionText, embedFn) {
    try {
      const embResult = await embedFn([questionText], "retrieval.query");
      if (embResult && embResult.length > 0) {
        return embResult[0];
      }
    } catch {
      // embedding failed
    }
    return null;
  }

  isDuplicate(newEmb) {
    if (this.askedEmbeddings.length === 0) return false;

    const newNorm = Math.sqrt(newEmb.reduce((sum, v) => sum + v * v, 0));
    if (newNorm === 0) return false;
    const newNormed = newEmb.map((v) => v / newNorm);

    let maxSim = 0;
    for (const asked of this.askedEmbeddings) {
      const askedNorm = Math.sqrt(asked.reduce((sum, v) => sum + v * v, 0));
      if (askedNorm === 0) continue;
      const askedNormed = asked.map((v) => v / askedNorm);
      let sim = 0;
      for (let i = 0; i < newNormed.length; i++) {
        sim += askedNormed[i] * newNormed[i];
      }
      if (sim > maxSim) maxSim = sim;
    }

    return maxSim >= DEDUP_THRESHOLD;
  }
}
