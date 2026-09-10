import { TopicEntry } from "../models/topic.js";
import { TopicStatus } from "../models/topic-status.js";
import { getLogger } from "../logging/logger.js";

const MAX_TOPICS = 12;

export async function buildTopicPlan(params) {
  const { resumeText, jdText, jobRole, llm, totalQuestions, strategy } = params;
  const requestCount = Math.min(totalQuestions + 4, MAX_TOPICS);
  const rawTopics = await extractTopics({
    resumeText,
    jdText,
    jobRole,
    llm,
    count: requestCount,
    strategy,
  });

  const topicPlan = rawTopics.map(
    (t) =>
      new TopicEntry({
        id: t.id,
        label: t.label,
        source: t.source,
        primaryQuestion: t.primary_question,
        priority: t.priority,
        status: TopicStatus.AVAILABLE,
      }),
  );

  getLogger().info(
    { topics: topicPlan.map((t) => ({ label: t.label, source: t.source })) },
    "[TOPIC_PLAN] Built plan with %d topics",
    topicPlan.length,
  );
  return topicPlan;
}

async function extractTopics(params) {
  const { resumeText, jdText, jobRole, llm, count, strategy } = params;
  const strategyBlock = strategy ? "\n\n" + strategy.getInitialPlanningInstructions() : "";

  const messages = [
    {
      role: "system",
      content:
        "You are an expert interview planner. Given a candidate's resume and a job description, " +
        "create a focused interview plan.\n\n" +
        "OUTPUT FORMAT — return ONLY valid JSON:\n" +
        '{"topics": [{"id": "...", "label": "...", "source": "...", "priority": N, "primary_question": "..."}]}\n\n' +
        "RULES:\n" +
        `- Generate at least ${count} topics, ideally up to ${count + 2}.\n` +
        "- Each topic MUST belong to a specific source entity from the resume: " +
        "a work experience (company name), a project name, education, or certification.\n" +
        "- The 'source' field MUST be the exact entity name from the resume " +
        "(e.g., 'Uber Software Engineer', 'MergePilot', 'AcadAssist', 'Education').\n" +
        "- NEVER mix facts from different projects, jobs, or resume sections. " +
        "A question about MergePilot must only use MergePilot facts.\n" +
        "- Merge topics that represent the SAME interviewable subject.\n" +
        "- Rank by relevance to the job role (10=highest, 1=lowest).\n" +
        "- Each topic gets ONE primary question that is specific, grounded in the resume, " +
        "and uses concrete details (project names, tools, metrics).\n" +
        "- Do NOT invent tools, technologies, metrics, or responsibilities not in the resume.\n" +
        "- Do NOT combine technologies from different projects unless the resume explicitly states they were used together.\n" +
        "- topic id: short snake_case identifier (e.g., 'uber_pagination', 'mergepilot_architecture')\n" +
        "- label: 5-15 word description of the interviewable subject\n" +
        "- question: 15-35 words, specific and grounded in resume evidence\n" +
        "- source: REQUIRED — must be a specific entity name from the resume, never empty\n" +
        strategyBlock,
    },
    {
      role: "user",
      content:
        `Job Role: ${jobRole}\n\n` +
        `=== CANDIDATE RESUME ===\n${resumeText}\n\n` +
        `=== JOB DESCRIPTION ===\n${jdText}\n\n` +
        `Create an interview plan with at most ${count} topics. ` +
        "Return ONLY valid JSON.",
    },
  ];

  const raw = await llm.chat(messages, 4096);
  const data = llm.parseJson(raw);

  const topics = data.topics;
  if (!Array.isArray(topics) || topics.length === 0) {
    getLogger().warn("[TOPIC_PLAN] LLM returned no topics, retrying with stricter prompt");
    return retryExtract({ resumeText, jdText, jobRole, llm, count });
  }

  const result = [];
  const seenIds = new Set();

  for (const t of topics) {
    if (typeof t !== "object" || t === null) continue;
    const tid = String(t.id || "").trim();
    const label = String(t.label || "").trim();
    const source = String(t.source || "").trim();
    const primaryQuestion = String(t.primary_question || "").trim();
    let priority = Number(t.priority || 5);

    if (!label || !primaryQuestion || !source) continue;
    if (seenIds.has(tid)) continue;
    if (!Number.isInteger(priority) || priority < 1 || priority > 10) priority = 5;

    seenIds.add(tid);
    result.push({ id: tid, label, source, priority, primary_question: primaryQuestion });
  }

  if (result.length === 0) {
    getLogger().warn("[TOPIC_PLAN] No valid topics after parsing, retrying");
    return retryExtract({ resumeText, jdText, jobRole, llm, count });
  }

  result.sort((a, b) => b.priority - a.priority);
  return result;
}

async function retryExtract(params) {
  const { resumeText, jdText, jobRole, llm, count } = params;

  const messages = [
    {
      role: "system",
      content:
        "Return ONLY a JSON object. No markdown. No explanation.\n" +
        `Return at most ${count} topics.\n` +
        '{"topics": [{"id": "string", "label": "string", "source": "string", ' +
        '"priority": 1-10, "primary_question": "string"}]}\n' +
        "Each topic MUST have: id, label, source (entity from resume), priority, primary_question.\n" +
        "source must be a specific entity name from the resume, not 'Candidate'.",
    },
    {
      role: "user",
      content:
        `Job Role: ${jobRole}\n\n` +
        `Resume:\n${resumeText}\n\n` +
        `JD:\n${jdText}\n\n` +
        "Return ONLY valid JSON with topics.",
    },
  ];

  const raw = await llm.chat(messages, 2048);
  const data = llm.parseJson(raw);

  const topics = data.topics || [];
  const result = [];
  const seenIds = new Set();

  for (const t of topics) {
    if (typeof t !== "object" || t === null) continue;
    const tid = String(t.id || "").trim();
    const label = String(t.label || "").trim();
    const source = String(t.source || "").trim();
    const primaryQuestion = String(t.primary_question || "").trim();
    const priority = Number(t.priority || 5);

    if (!label || !primaryQuestion) continue;
    if (seenIds.has(tid)) continue;

    seenIds.add(tid);
    result.push({
      id: tid || `topic_${result.length}`,
      label,
      source: source || jobRole,
      priority: Number.isInteger(priority) ? priority : 5,
      primary_question: primaryQuestion,
    });
  }

  return result.slice(0, count);
}
