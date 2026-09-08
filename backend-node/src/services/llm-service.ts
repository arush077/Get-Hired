import { getConfig } from "../config/env.js";
import { getLogger } from "../logging/logger.js";

const GROQ_MODEL = "openai/gpt-oss-120b";
const MAX_RETRIES = 3;

const CONCISENESS_INSTRUCTION =
  "Ask ONE concise interview question (15-35 words). " +
  "Focus on ONE concept. Do not combine multiple questions or requirements. " +
  "Do not list topics to discuss — ask a single focused question. ";

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

interface GroqResponse {
  choices: { message: { content: string } }[];
}

export class LLMService {
  private apiKey: string;

  constructor() {
    this.apiKey = getConfig().GROQ_API_KEY;
  }

  async chat(messages: ChatMessage[], maxTokens = 512): Promise<string> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages,
            temperature: 0.7,
            max_tokens: maxTokens,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          if (response.status === 429) {
            const wait = Math.min(60, 10 * (attempt + 1));
            getLogger().warn(
              { attempt: attempt + 1, maxRetries: MAX_RETRIES, wait },
              "[LLM] rate limited, retrying",
            );
            if (attempt < MAX_RETRIES - 1) {
              await new Promise((r) => setTimeout(r, wait * 1000));
              continue;
            }
            throw new Error(`Groq rate limited: ${errorBody}`);
          }
          throw new Error(`Groq API error ${response.status}: ${errorBody}`);
        }

        const data = (await response.json()) as GroqResponse;
        return data.choices[0].message.content.trim();
      } catch (err) {
        if (attempt === MAX_RETRIES - 1) throw err;
        const wait = Math.min(60, 10 * (attempt + 1));
        getLogger().warn(
          { attempt: attempt + 1, error: (err as Error).message },
          "[LLM] request failed, retrying",
        );
        await new Promise((r) => setTimeout(r, wait * 1000));
      }
    }
    throw new Error("LLM: max retries exhausted");
  }

  async generateContent(prompt: string, maxTokens = 1024): Promise<string> {
    return this.chat([{ role: "user", content: prompt }], maxTokens);
  }

  parseJson(text: string): Record<string, unknown> {
    let cleaned = text;
    if (cleaned.includes("```")) {
      const match = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
      if (match) cleaned = match[1].trim();
    }

    try {
      return JSON.parse(cleaned);
    } catch {
      // try to extract JSON object
    }

    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      let candidate = match[0];
      try {
        return JSON.parse(candidate);
      } catch {
        if (!candidate.endsWith("}")) candidate += "}";
        try {
          return JSON.parse(candidate);
        } catch {
          // fall through
        }
      }
    }

    throw new Error(`Could not parse JSON from LLM response: ${text.slice(0, 200)}`);
  }

  validateQuestion(text: string): boolean {
    if (!text || text.trim().length === 0) return false;
    const trimmed = text.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("```")) return false;
    if (trimmed.length > 400) return false;
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount < 3 || wordCount > 60) return false;
    return true;
  }

  async generateWithRetry(messages: ChatMessage[], maxTokens = 512): Promise<string> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const raw = await this.chat(messages, maxTokens);
      try {
        const data = this.parseJson(raw);
        const question = (data.question as string) || "";
        if (this.validateQuestion(question)) return question;
        getLogger().warn(
          { attempt: attempt + 1, question: question.slice(0, 100) },
          "[LLM] question validation failed",
        );
      } catch (e) {
        getLogger().warn(
          { attempt: attempt + 1, error: (e as Error).message },
          "[LLM] JSON parse failed",
        );
      }

      if (attempt === MAX_RETRIES - 1) {
        // Fallback: try to extract a question from raw text
        const qMatch = raw.match(/"question"\s*:\s*"([^"]+)"/);
        if (qMatch && this.validateQuestion(qMatch[1])) return qMatch[1];
        const sentMatch = raw.match(/([A-Z][^.?!]{10,200}[.?!])/);
        if (sentMatch && this.validateQuestion(sentMatch[1])) return sentMatch[1];
        getLogger().error({ raw: raw.slice(0, 300) }, "[LLM] all retries exhausted, using fallback");
      }
    }
    return "Can you tell me more about your experience?";
  }

  async generateHrQuestion(candidateName: string, jobRole: string, variant: string): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "You are a friendly technical interviewer. " +
          `Generate ONE ${variant} interview question for a candidate ` +
          `named ${candidateName} who is interviewing for ${jobRole}. ` +
          "Keep it conversational and concise (15-30 words). " +
          "Do NOT ask technical questions — this is an HR/personal question. " +
          "Ask only ONE question, not multiple. " +
          'Return ONLY valid JSON: {"question": "..."}',
      },
      {
        role: "user",
        content: `Generate a ${variant} question for ${candidateName}.`,
      },
    ];
    return this.generateWithRetry(messages);
  }

  async classifyAndDecide(params: {
    resumeText: string;
    jdText: string;
    jobRole: string;
    currentTopicLabel: string;
    currentTopicSource: string;
    currentQuestion: string;
    candidateAnswer: string;
    questionsOnTopic: number;
    topicsRemaining: string[];
    interviewHistory: { question: string; answer: string }[];
    previouslyAskedQuestions: string[];
    strategy?: { getRuntimeInstructions(): string };
  }): Promise<{
    answerStatus: string;
    nextAction: string;
    nextTopicId: string | null;
    reason: string;
    question: string | null;
    clarificationText: string | null;
  }> {
    const remainingText = params.topicsRemaining.slice(0, 8).join(", ") || "none remaining";
    const askedText = params.previouslyAskedQuestions.slice(-5).map((q) => `- ${q}`).join("\n") || "none yet";
    let historyText = "";
    for (const qa of params.interviewHistory.slice(-3)) {
      historyText += `Q: ${qa.question}\nA: ${qa.answer}\n\n`;
    }

    const strategyBlock = params.strategy ? "\n\n" + params.strategy.getRuntimeInstructions() : "";

    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "You are an expert interview analyst. Analyze the candidate's answer and decide what to do next.\n\n" +
          "STEP 1: Classify the answer status:\n" +
          "- ANSWERED: Candidate provided a meaningful answer with substance\n" +
          "- PARTIAL_ANSWER: Candidate started answering but it's incomplete or lacks detail\n" +
          "- DOES_NOT_KNOW: Candidate explicitly says they don't know, have no experience, weren't involved, or someone else handled it\n" +
          "- NEEDS_CLARIFICATION: Candidate is asking what the question means or asking for clarification\n\n" +
          "STEP 2: Decide the next action:\n" +
          "- FOLLOW_UP: Answer is incomplete or interesting — ask a deeper follow-up on the SAME topic. " +
          "Generate the follow-up question in the 'question' field.\n" +
          "- NEW_TOPIC: Answer is sufficient, topic is explored, or candidate doesn't know. Move on.\n" +
          "- CLARIFY: Candidate didn't understand. Generate a genuine rephrasing in 'clarification_text'.\n" +
          "- END: Interview is complete.\n\n" +
          "PROVENANCE RULES — CRITICAL:\n" +
          `- The current topic is about: ${params.currentTopicSource}\n` +
          "- ONLY use facts from the Resume/JD context provided below.\n" +
          "- NEVER invent candidate experience, projects, technologies, responsibilities, or achievements.\n" +
          "- NEVER mix facts from different projects, jobs, or resume sections.\n" +
          "- If the context mentions a specific tool or metric for THIS topic, you may reference it.\n" +
          "- Do NOT reference tools, metrics, or responsibilities from OTHER projects or experiences.\n" +
          `${strategyBlock}\n\n` +
          "RULES:\n" +
          "- If answer_status is DOES_NOT_KNOW, next_action MUST be NEW_TOPIC.\n" +
          "- If answer_status is NEEDS_CLARIFICATION, next_action MUST be CLARIFY.\n" +
          `- If questions_on_topic >= 2, next_action MUST be NEW_TOPIC (hard cap).\n` +
          "- Prefer topic diversity. Don't stay on the same topic unless the follow-up is truly valuable.\n" +
          "- IMPORTANT: 'no' or 'did not' in a substantive answer is NOT DOES_NOT_KNOW.\n" +
          "- For FOLLOW_UP: generate a question (15-35 words) grounded in the resume evidence for this topic.\n" +
          "- For CLARIFY: genuinely rephrase the question. Do NOT just prepend 'Let me rephrase that.'.\n" +
          "- For NEW_TOPIC: suggest next_topic_id from available topics if possible.\n\n" +
          `Current topic: ${params.currentTopicLabel} (${params.currentTopicSource})\n` +
          `Questions asked on this topic: ${params.questionsOnTopic}\n` +
          `Available topics: ${remainingText}\n` +
          `Previously asked questions:\n${askedText}\n\n` +
          'Return ONLY valid JSON: {"answer_status": "...", "next_action": "...", "next_topic_id": null, ' +
          '"reason": "...", "question": null, "clarification_text": null}\n' +
          "- question: filled only when next_action is FOLLOW_UP\n" +
          "- clarification_text: filled only when next_action is CLARIFY\n" +
          "- next_topic_id: suggested topic for NEW_TOPIC, or null\n" +
          "- reason: one sentence for debugging",
      },
      {
        role: "user",
        content:
          `Job Role: ${params.jobRole}\n\n` +
          `=== CANDIDATE RESUME ===\n${params.resumeText}\n\n` +
          `=== JOB DESCRIPTION ===\n${params.jdText}\n\n` +
          `Current Question: ${params.currentQuestion}\n` +
          `Candidate Answer: ${params.candidateAnswer}\n\n` +
          `Recent Interview History:\n${historyText}`,
      },
    ];

    const raw = await this.chat(messages, 1024);
    try {
      const data = this.parseJson(raw);
      let answerStatus = (data.answer_status as string) || "ANSWERED";
      let nextAction = (data.next_action as string) || "NEW_TOPIC";
      const clarificationText = data.clarification_text as string | null;
      const question = data.question as string | null;
      const nextTopicId = data.next_topic_id as string | null;

      if (!["ANSWERED", "PARTIAL_ANSWER", "DOES_NOT_KNOW", "NEEDS_CLARIFICATION"].includes(answerStatus)) {
        answerStatus = "ANSWERED";
      }
      if (!["FOLLOW_UP", "NEW_TOPIC", "CLARIFY", "END"].includes(nextAction)) {
        nextAction = "NEW_TOPIC";
      }

      return {
        answerStatus,
        nextAction,
        nextTopicId,
        reason: (data.reason as string) || "",
        question: nextAction === "FOLLOW_UP" ? question : null,
        clarificationText: nextAction === "CLARIFY" ? clarificationText : null,
      };
    } catch (e) {
      getLogger().warn({ error: (e as Error).message }, "[LLM] classify_and_decide parse failed");
      return {
        answerStatus: "ANSWERED",
        nextAction: "NEW_TOPIC",
        nextTopicId: null,
        reason: `Parse failed: ${(e as Error).message}`,
        question: null,
        clarificationText: null,
      };
    }
  }

  async generateAnalysis(interviewContext: {
    resumeText: string;
    jdText: string;
    jobRole: string;
    questions: { index: number; text: string; type: string; topicLabel: string; topicSource: string }[];
    answers: { index: number; transcript: string; answerStatus: string | null }[];
    strategy?: { getEvaluationInstructions(): string };
  }): Promise<Record<string, unknown>> {
    const { resumeText, jdText, jobRole, questions, answers } = interviewContext;

    const qaLines: string[] = [];
    for (const q of questions) {
      const a = answers.find((a) => a.index === q.index);
      const aText = a?.transcript || "(no answer captured)";
      const aStatus = a?.answerStatus || "unknown";
      qaLines.push(
        `Q${q.index + 1} [${q.type}] (topic: ${q.topicLabel} / ${q.topicSource}):\n` +
        `  Question: ${q.text}\n` +
        `  Answer (${aStatus}): ${aText}`,
      );
    }
    const qaBlock = qaLines.join("\n\n");

    const strategyBlock = interviewContext.strategy
      ? "\n\n" + interviewContext.strategy.getEvaluationInstructions()
      : "";

    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "You are an expert interview evaluator. Analyze the completed interview " +
          "and provide a detailed structured evaluation.\n\n" +
          "INPUT: You receive the candidate's resume, the target job description, " +
          "and the full interview transcript with question types, topics, and answer statuses.\n\n" +
          "EVALUATION RULES:\n" +
          "- Evaluate ONLY what the candidate actually demonstrated.\n" +
          "- Do not assume skills not demonstrated or invent experience.\n" +
          "- Judge answers in context of the specific questions asked.\n" +
          "- Evaluate the interview as a whole for patterns.\n" +
          "- Penalize vague, incomplete, repetitive, or off-topic answers.\n" +
          "- Reward specific examples, clear reasoning, structured answers.\n" +
          "- Do not require every answer to contain a measurable metric.\n" +
          "- For recurring patterns: only report if visible in 2+ answers.\n" +
          "- For JD match: compare demonstrated skills against JD requirements.\n" +
          `${strategyBlock}\n\n` +
          "OUTPUT SCHEMA (return ONLY valid JSON):\n" +
          "{\n" +
          '  "overall_score": int (0-100),\n' +
          '  "dimensions": {\n' +
          '    "technical_depth": int (0-100),\n' +
          '    "correctness": int (0-100),\n' +
          '    "specificity": int (0-100),\n' +
          '    "clarity": int (0-100),\n' +
          '    "communication": int (0-100)\n' +
          "  },\n" +
          '  "strengths": [str, str],\n' +
          '  "areas_to_improve": [str, str],\n' +
          '  "recurring_patterns": [str, str],\n' +
          '  "question_feedback": [{ "question_number": int, "score": int, "what_went_well": str, "what_was_missing": str, "how_to_improve": str }],\n' +
          '  "recommendations": [str, str],\n' +
          '  "jd_match": { "strengths": [str, str], "gaps": [str, str] }\n' +
          "}\n\n" +
          "DIMENSION GUIDELINES:\n" +
          "- technical_depth: Understanding of concepts, not just naming tools\n" +
          "- correctness: Accuracy of technical claims and approaches\n" +
          "- specificity: Concrete examples, metrics, details vs vague statements\n" +
          "- clarity: How well answers are structured and explained\n" +
          "- communication: Overall clarity, conciseness, and flow of responses\n\n" +
          "PER-QUESTION FEEDBACK:\n" +
          "- Reference the actual question and actual answer\n" +
          "- Be specific, not generic\n" +
          "- Score reflects how well that particular answer addressed the question\n\n" +
          "RECOMMENDATIONS:\n" +
          "- Must be concrete and practiceable\n" +
          "- Based on the actual recurring weaknesses identified\n\n" +
          "JD MATCH:\n" +
          "- Compare what the candidate demonstrated against the JD requirements\n" +
          "- Cite specific evidence from their answers\n" +
          "- Do not simply repeat the JD text",
      },
      {
        role: "user",
        content:
          `Job Role: ${jobRole}\n\n` +
          `=== CANDIDATE RESUME ===\n${resumeText}\n\n` +
          `=== JOB DESCRIPTION ===\n${jdText}\n\n` +
          `=== INTERVIEW TRANSCRIPT ===\n\n${qaBlock}`,
      },
    ];

    const raw = await this.chat(messages, 4096);
    try {
      const data = this.parseJson(raw);

      data.overall_score = Math.max(0, Math.min(100, Number(data.overall_score || 0)));
      if (data.dimensions && typeof data.dimensions === "object") {
        data.dimensions = Object.fromEntries(
          Object.entries(data.dimensions as Record<string, unknown>).map(([k, v]) => [
            k,
            Math.max(0, Math.min(100, Number(v || 0))),
          ]),
        );
      }

      data.dimensions ??= {};
      data.strengths ??= [];
      data.areas_to_improve ??= [];
      data.recurring_patterns ??= [];
      data.question_feedback ??= [];
      data.recommendations ??= [];
      data.jd_match ??= null;

      for (const qf of (data.question_feedback as Record<string, unknown>[]) || []) {
        if (typeof qf === "object" && qf !== null) {
          qf.score = Math.max(0, Math.min(100, Number(qf.score || 0)));
          for (const field of ["what_went_well", "what_was_missing", "how_to_improve"]) {
            if (!qf[field]) qf[field] = "";
          }
        }
      }

      return data;
    } catch (e) {
      getLogger().warn({ error: (e as Error).message }, "[LLM] generate_analysis parse failed");
      return {
        overall_score: 0,
        dimensions: {},
        strengths: [],
        areas_to_improve: ["Analysis generation failed. Please retry."],
        recurring_patterns: [],
        question_feedback: [],
        recommendations: [],
        jd_match: null,
      };
    }
  }
}
