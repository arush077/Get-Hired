import { getConfig } from "../config/env.js";
import { getLogger } from "../logging/logger.js";

const GROQ_MODEL = "openai/gpt-oss-120b";
const GROQ_FAST_MODEL = "openai/gpt-oss-20b";
const MAX_RETRIES = 3;

const CONCISENESS_INSTRUCTION =
  "Ask ONE concise interview question (15-35 words). " +
  "Focus on ONE concept. Do not combine multiple questions or requirements. " +
  "Do not list topics to discuss — ask a single focused question. ";

export class LLMService {
  constructor() {
    this._apiKey = getConfig().GROQ_API_KEY;
  }

  async chat(messages, maxTokens = 512, timeoutMs = 60_000, model = GROQ_MODEL) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        let response;
        try {
          response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${this._apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              messages,
              temperature: 0.7,
              max_tokens: maxTokens,
            }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }

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

        const data = await response.json();
        return data.choices[0].message.content.trim();
      } catch (err) {
        if (err.name === "AbortError") {
          getLogger().warn(
            { attempt: attempt + 1, timeoutMs },
            "[LLM] request timed out, retrying",
          );
          if (attempt < MAX_RETRIES - 1) {
            await new Promise((r) => setTimeout(r, 10_000));
            continue;
          }
          throw new Error(`LLM request timed out after ${MAX_RETRIES} attempts`);
        }
        if (attempt === MAX_RETRIES - 1) throw err;
        const wait = Math.min(60, 10 * (attempt + 1));
        getLogger().warn(
          { attempt: attempt + 1, error: err.message },
          "[LLM] request failed, retrying",
        );
        await new Promise((r) => setTimeout(r, wait * 1000));
      }
    }
    throw new Error("LLM: max retries exhausted");
  }

  async generateContent(prompt, maxTokens = 1024) {
    return this.chat([{ role: "user", content: prompt }], maxTokens);
  }

  parseJson(text) {
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

  validateQuestion(text) {
    if (!text || text.trim().length === 0) return false;
    const trimmed = text.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("```")) return false;
    if (trimmed.length > 400) return false;
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount < 3 || wordCount > 60) return false;
    return true;
  }

  async generateWithRetry(messages, maxTokens = 512) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const raw = await this.chat(messages, maxTokens);
      try {
        const data = this.parseJson(raw);
        const question = data.question || "";
        if (this.validateQuestion(question)) return question;
        getLogger().warn(
          { attempt: attempt + 1, question: question.slice(0, 100) },
          "[LLM] question validation failed",
        );
      } catch (e) {
        getLogger().warn(
          { attempt: attempt + 1, error: e.message },
          "[LLM] JSON parse failed",
        );
      }

      if (attempt === MAX_RETRIES - 1) {
        const qMatch = raw.match(/"question"\s*:\s*"([^"]+)"/);
        if (qMatch && this.validateQuestion(qMatch[1])) return qMatch[1];
        const sentMatch = raw.match(/([A-Z][^.?!]{10,200}[.?!])/);
        if (sentMatch && this.validateQuestion(sentMatch[1])) return sentMatch[1];
        getLogger().error({ raw: raw.slice(0, 300) }, "[LLM] all retries exhausted, using fallback");
      }
    }
    return "Can you tell me more about your experience?";
  }

  async generateHrQuestion(candidateName, jobRole, variant) {
    const messages = [
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

  async classifyAndDecide(params) {
    const remainingText = params.topicsRemaining.slice(0, 8).join(", ") || "none remaining";
    const askedText = params.previouslyAskedQuestions.slice(-5).map((q) => `- ${q}`).join("\n") || "none yet";
    let historyText = "";
    for (const qa of params.interviewHistory.slice(-3)) {
      historyText += `Q: ${qa.question}\nA: ${qa.answer}\n\n`;
    }

    const strategyBlock = params.strategy ? "\n\n" + params.strategy.getRuntimeInstructions() : "";

    const messages = [
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

    const raw = await this.chat(messages, 1024, 60_000, GROQ_FAST_MODEL);
    try {
      const data = this.parseJson(raw);
      let answerStatus = data.answer_status || "ANSWERED";
      let nextAction = data.next_action || "NEW_TOPIC";
      const clarificationText = data.clarification_text;
      const question = data.question;
      const nextTopicId = data.next_topic_id;

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
        reason: data.reason || "",
        question: nextAction === "FOLLOW_UP" ? question : null,
        clarificationText: nextAction === "CLARIFY" ? clarificationText : null,
      };
    } catch (e) {
      getLogger().warn({ error: e.message }, "[LLM] classify_and_decide parse failed");
      return {
        answerStatus: "ANSWERED",
        nextAction: "NEW_TOPIC",
        nextTopicId: null,
        reason: `Parse failed: ${e.message}`,
        question: null,
        clarificationText: null,
      };
    }
  }

  async generateAnalysis(interviewContext) {
    const { resumeText, jdText, jobRole, questions, answers } = interviewContext;

    const qaLines = [];
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

    const messages = [
      {
        role: "system",
        content:
          "You are an expert interview evaluator. Evaluate the completed interview fairly, consistently, and with a supportive but honest standard.\n\n" +
          "INPUT:\n" +
          "You receive:\n" +
          "- candidate resume\n" +
          "- job description\n" +
          "- full interview transcript\n" +
          "- question types, topics, and answer statuses\n\n" +
          "CORE RULES:\n" +
          "- Evaluate only what the candidate actually demonstrated.\n" +
          "- Do not invent experience, skills, metrics, or examples.\n" +
          "- Judge each answer mainly against the ACTUAL QUESTION TEXT.\n" +
          "- Ignore the topic label when it does not match the question.\n" +
          "- Evaluate answers in the context of the candidate's experience level and the difficulty of the question.\n" +
          "- A concise, correct answer can still be a good answer.\n" +
          "- Missing detail is NOT the same as incorrect information.\n" +
          "- Missing detail should mainly reduce specificity or depth, not correctness.\n" +
          "- Do not require metrics unless the question asks for them or they are important to support the answer.\n" +
          "- Do not require named frameworks, formulas, tools, code, or methodologies unless relevant to the question.\n" +
          "- Do not require STAR unless the question is explicitly behavioral and the structure matters.\n" +
          "- Do not penalize normal speech patterns, filler words, repetitions, minor grammar mistakes, or reasonable speech-to-text errors.\n" +
          "- Penalize clarity only when the meaning of the answer is genuinely difficult to understand.\n" +
          "- If the candidate says they do not have experience with something, do not treat that as an incorrect answer.\n" +
          "- Evaluate with a supportive interview standard: identify genuine weaknesses without looking for reasons to lower the score.\n" +
          "- Do not search for minor omissions simply to justify a lower score.\n" +
          "- Do not inflate scores either. Scores should reflect demonstrated evidence.\n" +
          "- For a junior or fresher candidate, reasonable foundational understanding should be recognized positively even when advanced depth is missing.\n" +
          "- A decent answer should generally fall in the GOOD or STRONG range unless it has a meaningful correctness, relevance, or completeness problem.\n\n" +
          "INTERVIEW MODE:\n\n" +
          `${strategyBlock}\n\n` +
          "SCORING CALIBRATION:\n\n" +
          "90-100 = Excellent\n" +
          "Exceptionally strong answer. Correct, highly relevant, specific, well-reasoned, and demonstrates strong depth.\n\n" +
          "80-89 = Very Strong\n" +
          "Strong answer with good understanding, useful detail, and clear reasoning. Only minor gaps.\n\n" +
          "70-79 = Good\n" +
          "Solid answer that correctly addresses the question and demonstrates reasonable understanding. May lack some depth, detail, or examples.\n\n" +
          "60-69 = Fair / Developing\n" +
          "Generally relevant answer with a reasonable foundation, but noticeably incomplete, general, or underdeveloped.\n\n" +
          "45-59 = Limited\n" +
          "Significant gaps, weak explanation, substantial vagueness, or limited evidence of the required understanding.\n\n" +
          "0-44 = Poor\n" +
          "Incorrect, largely irrelevant, no meaningful attempt, or a major lack of understanding where the question directly tests that area.\n\n" +
          "IMPORTANT CALIBRATION:\n" +
          "- A correct but brief answer will usually score around 70-80, depending on the question difficulty.\n" +
          "- A correct but incomplete technical answer should usually retain relatively high correctness while losing points in depth or specificity.\n" +
          "- Do not place a decent answer in the 40s simply because a stronger answer was possible.\n" +
          "- Do not require an ideal or interview-textbook answer to reach the 70s.\n" +
          "- A candidate does not need to mention every possible detail to receive a GOOD score.\n" +
          "- Missing optional metrics, frameworks, examples, formulas, or terminology should not by themselves push an answer below 70 when the core answer is correct and relevant.\n" +
          "- Scores below 60 should be reserved for answers with meaningful weaknesses, not ordinary brevity or minor omissions.\n" +
          "- Scores below 45 should be uncommon and should indicate a clear problem with correctness, relevance, or demonstrated understanding.\n" +
          "- An unanswered question or explicit lack of required experience may receive a low score when that is what the question directly measures.\n" +
          "- One weak or unanswered question should not disproportionately lower the overall interview score.\n\n" +
          "DIMENSIONS:\n\n" +
          "technical_depth:\n" +
          "How deeply the candidate demonstrates relevant technical understanding.\n\n" +
          "correctness:\n" +
          "Whether the candidate's claims and reasoning are accurate. Missing detail alone should not substantially lower correctness.\n\n" +
          "specificity:\n" +
          "How concretely the candidate explains relevant details, decisions, examples, or actions. Metrics are optional unless relevant.\n\n" +
          "clarity:\n" +
          "How easy the answer is to understand. Tolerate normal speech patterns and reasonable ASR errors.\n\n" +
          "communication:\n" +
          "Overall quality, coherence, conciseness, and flow.\n\n" +
          "PER-QUESTION FEEDBACK:\n\n" +
          "For every question:\n" +
          "- Score how well the answer addressed the actual question.\n" +
          "- Mention the strongest thing the candidate demonstrated.\n" +
          "- Mention only the most important missing detail, if any.\n" +
          "- Give one or two practical ways to improve.\n" +
          "- Be constructive rather than overly critical.\n" +
          "- Do not manufacture weaknesses to justify a lower score.\n" +
          "- If the answer is correct but incomplete, explicitly distinguish the two.\n" +
          "- If the answer is incorrect, identify the actual incorrect claim.\n" +
          "- Do not invent examples, metrics, frameworks, or experiences.\n\n" +
          "RECURRING PATTERNS:\n\n" +
          "Only report a weakness or strength as a recurring pattern if it appears in at least 2 answers.\n\n" +
          "RECOMMENDATIONS:\n\n" +
          "Give practical recommendations based on the most important weaknesses actually shown. " +
          "Prioritize a small number of high-value improvements. " +
          "Do not add arbitrary frameworks or techniques.\n\n" +
          "JD MATCH:\n\n" +
          "Compare demonstrated evidence against the JD. Separate:\n" +
          "- demonstrated strengths\n" +
          "- partial evidence\n" +
          "- gaps / no demonstrated evidence\n\n" +
          "Do not claim the candidate lacks a skill simply because it was not tested. " +
          "Do not claim experience that is not supported by the resume or interview.\n\n" +
          "OVERALL SCORE:\n\n" +
          "The overall score represents the interview as a whole.\n\n" +
          "Consider:\n" +
          "- quality of individual answers\n" +
          "- consistency across the interview\n" +
          "- selected interview mode\n" +
          "- candidate experience level\n" +
          "- technical depth and correctness where relevant\n" +
          "- clarity and communication where relevant\n\n" +
          "Use the following general calibration for the overall interview:\n\n" +
          "90-100: Exceptional interview performance with strong and consistent evidence.\n" +
          "80-89: Strong interview with good technical/role understanding and only minor gaps.\n" +
          "70-79: Good interview. Candidate demonstrates solid relevant understanding with some areas that could be developed further.\n" +
          "60-69: Fair interview. Candidate shows a reasonable foundation but has several noticeable gaps.\n" +
          "45-59: Weak interview. Significant gaps or inconsistent evidence across important areas.\n" +
          "0-44: Very weak interview. Major correctness, relevance, or demonstrated-competency problems.\n\n" +
          "IMPORTANT:\n" +
          "- Do not simply average the dimensions.\n" +
          "- Give greater weight to the dimensions specified by the selected interview mode.\n" +
          "- A single weak or unanswered question should not dominate the overall score.\n" +
          "- Missing optional detail should not disproportionately reduce the overall score.\n" +
          "- Keep the overall score broadly consistent with the individual question scores.\n" +
          "- The purpose is fair assessment, not aggressive elimination.\n" +
          "- Do not inflate scores just to be positive; reward what the candidate actually demonstrated.\n\n" +
          "OUTPUT:\n\n" +
          "Return ONLY valid JSON:\n" +
          "{\n" +
          '  "overall_score": int,\n' +
          '  "dimensions": {\n' +
          '    "technical_depth": int,\n' +
          '    "correctness": int,\n' +
          '    "specificity": int,\n' +
          '    "clarity": int,\n' +
          '    "communication": int\n' +
          "  },\n" +
          '  "strengths": [str, str],\n' +
          '  "areas_to_improve": [str, str],\n' +
          '  "recurring_patterns": [str, str],\n' +
          '  "question_feedback": [\n' +
          "    {\n" +
          '      "question_number": int,\n' +
          '      "score": int,\n' +
          '      "what_went_well": str,\n' +
          '      "what_was_missing": str,\n' +
          '      "how_to_improve": str\n' +
          "    }\n" +
          "  ],\n" +
          '  "recommendations": [str, str],\n' +
          '  "jd_match": {\n' +
          '    "strengths": [str, str],\n' +
          '    "gaps": [str, str]\n' +
          "  }\n" +
          "}",
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

    const raw = await this.chat(messages, 8192, 120_000);
    try {
      const data = this.parseJson(raw);

      data.overall_score = Math.max(0, Math.min(100, Number(data.overall_score || 0)));
      if (data.dimensions && typeof data.dimensions === "object") {
        data.dimensions = Object.fromEntries(
          Object.entries(data.dimensions).map(([k, v]) => [
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

      for (const qf of data.question_feedback || []) {
        if (typeof qf === "object" && qf !== null) {
          qf.score = Math.max(0, Math.min(100, Number(qf.score || 0)));
          for (const field of ["what_went_well", "what_was_missing", "how_to_improve"]) {
            if (!qf[field]) qf[field] = "";
          }
        }
      }

      return data;
    } catch (e) {
      getLogger().warn({ error: e.message }, "[LLM] generate_analysis parse failed");
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
