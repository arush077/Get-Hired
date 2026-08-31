import json
import logging

from domain.topic import TopicEntry, TopicStatus

logger = logging.getLogger(__name__)

MAX_TOPICS = 8


async def build_topic_plan(
    resume_text: str,
    jd_text: str,
    job_role: str,
    llm,
    total_questions: int,
) -> list[TopicEntry]:
    """Build topic plan with primary questions from full Resume + JD.

    ONE LLM call. No RAG. No chunking. No embeddings.

    Args:
        resume_text: Full resume text, ideally section-structured.
        jd_text: Full job description.
        job_role: Target job role.
        llm: LLMService instance.
        total_questions: Number of questions to plan for.
    """
    raw_topics = await _extract_topics(
        resume_text=resume_text,
        jd_text=jd_text,
        job_role=job_role,
        llm=llm,
        count=min(total_questions, MAX_TOPICS),
    )

    topic_plan = [
        TopicEntry(
            id=t["id"],
            label=t["label"],
            source=t["source"],
            primary_question=t["primary_question"],
            priority=t["priority"],
            status=TopicStatus.AVAILABLE,
        )
        for t in raw_topics
    ]

    logger.info(
        "[TOPIC_PLAN] Built plan with %d topics: %s",
        len(topic_plan),
        [(t.label, t.source) for t in topic_plan],
    )
    return topic_plan


async def _extract_topics(
    resume_text: str,
    jd_text: str,
    job_role: str,
    llm,
    count: int,
) -> list[dict]:
    """LLM call: extract topics with provenance and primary questions.

    Returns list of {id, label, source, priority, primary_question} dicts.
    """
    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert interview planner. Given a candidate's resume and a job description, "
                "create a focused interview plan.\n\n"
                "OUTPUT FORMAT — return ONLY valid JSON:\n"
                '{"topics": [{"id": "...", "label": "...", "source": "...", "priority": N, "primary_question": "..."}]}\n\n'
                "RULES:\n"
                "- Extract 6-8 topics representing concrete, interviewable subjects.\n"
                "- Each topic MUST belong to a specific source entity from the resume: "
                "a work experience (company name), a project name, education, or certification.\n"
                "- The 'source' field MUST be the exact entity name from the resume "
                "(e.g., 'Uber Software Engineer', 'MergePilot', 'AcadAssist', 'Education').\n"
                "- NEVER mix facts from different projects, jobs, or resume sections. "
                "A question about MergePilot must only use MergePilot facts.\n"
                "- Merge topics that represent the SAME interviewable subject.\n"
                "- Rank by relevance to the job role (10=highest, 1=lowest).\n"
                "- Each topic gets ONE primary question that is specific, grounded in the resume, "
                "and uses concrete details (project names, tools, metrics).\n"
                "- Do NOT invent tools, technologies, metrics, or responsibilities not in the resume.\n"
                "- Do NOT combine technologies from different projects unless the resume explicitly states they were used together.\n"
                "- topic id: short snake_case identifier (e.g., 'uber_pagination', 'mergepilot_architecture')\n"
                "- label: 5-15 word description of the interviewable subject\n"
                "- question: 15-35 words, specific and grounded in resume evidence\n"
                f"- At most {count} topics\n"
            ),
        },
        {
            "role": "user",
            "content": (
                f"Job Role: {job_role}\n\n"
                f"=== CANDIDATE RESUME ===\n{resume_text}\n\n"
                f"=== JOB DESCRIPTION ===\n{jd_text}\n\n"
                f"Create an interview plan with at most {count} topics. "
                "Return ONLY valid JSON."
            ),
        },
    ]

    raw = await llm._chat(messages, max_tokens=4096)
    data = llm._parse_json(raw)

    topics = data.get("topics", [])
    if not isinstance(topics, list) or len(topics) == 0:
        logger.warning("[TOPIC_PLAN] LLM returned no topics, retrying with stricter prompt")
        return await _retry_extract(resume_text, jd_text, job_role, llm, count)

    result = []
    seen_ids = set()
    for t in topics:
        if not isinstance(t, dict):
            continue
        tid = t.get("id", "").strip()
        label = t.get("label", "").strip()
        source = t.get("source", "").strip()
        primary_question = t.get("primary_question", "").strip()
        priority = t.get("priority", 5)

        if not label or not primary_question or not source:
            continue
        if tid in seen_ids:
            continue
        if not isinstance(priority, int) or priority < 1 or priority > 10:
            priority = 5

        seen_ids.add(tid)
        result.append({
            "id": tid,
            "label": label,
            "source": source,
            "priority": priority,
            "primary_question": primary_question,
        })

    if not result:
        logger.warning("[TOPIC_PLAN] No valid topics after parsing, retrying")
        return await _retry_extract(resume_text, jd_text, job_role, llm, count)

    result.sort(key=lambda t: -t["priority"])
    return result[:count]


async def _retry_extract(
    resume_text: str,
    jd_text: str,
    job_role: str,
    llm,
    count: int,
) -> list[dict]:
    """One retry with stricter instructions."""
    messages = [
        {
            "role": "system",
            "content": (
                "Return ONLY a JSON object. No markdown. No explanation.\n"
                f"Return at most {count} topics.\n"
                '{"topics": [{"id": "string", "label": "string", "source": "string", '
                '"priority": 1-10, "primary_question": "string"}]}\n'
                "Each topic MUST have: id, label, source (entity from resume), priority, primary_question.\n"
                "source must be a specific entity name from the resume, not 'Candidate'."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Job Role: {job_role}\n\n"
                f"Resume:\n{resume_text}\n\n"
                f"JD:\n{jd_text}\n\n"
                "Return ONLY valid JSON with topics."
            ),
        },
    ]

    raw = await llm._chat(messages, max_tokens=2048)
    data = llm._parse_json(raw)

    topics = data.get("topics", [])
    result = []
    seen_ids = set()
    for t in topics:
        if not isinstance(t, dict):
            continue
        tid = t.get("id", "").strip()
        label = t.get("label", "").strip()
        source = t.get("source", "").strip()
        primary_question = t.get("primary_question", "").strip()
        priority = t.get("priority", 5)

        if not label or not primary_question:
            continue
        if tid in seen_ids:
            continue
        if not source:
            source = job_role

        seen_ids.add(tid)
        result.append({
            "id": tid or f"topic_{len(result)}",
            "label": label,
            "source": source,
            "priority": priority if isinstance(priority, int) else 5,
            "primary_question": primary_question,
        })

    return result[:count]
