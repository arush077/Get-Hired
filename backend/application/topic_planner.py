import json
import logging

import numpy as np

from domain.topic import TopicEntry, TopicStatus

logger = logging.getLogger(__name__)

MERGE_THRESHOLD = 0.85


async def build_topic_plan(
    resume_text: str,
    jd_text: str,
    job_role: str,
    llm,
    rag,
    total_questions: int,
) -> list[TopicEntry]:
    """Build a topic plan ONCE at interview start.

    Uses a single LLM call to extract topics, then Python-side embedding
    similarity to merge duplicates the LLM missed.
    """
    raw_topics = await _extract_topics(
        resume_text=resume_text,
        jd_text=jd_text,
        job_role=job_role,
        llm=llm,
        count=total_questions,
    )

    topic_plan = [
        TopicEntry(
            id=f"topic_{i}",
            label=label,
            priority=i + 1,
            status=TopicStatus.AVAILABLE,
            source_context=context,
        )
        for i, (label, context) in enumerate(raw_topics)
    ]

    topic_plan = await _merge_duplicate_topics(topic_plan, rag)

    logger.info(
        "[TOPIC_PLAN] Built plan with %d topics: %s",
        len(topic_plan),
        [t.label for t in topic_plan],
    )
    return topic_plan


async def _extract_topics(
    resume_text: str,
    jd_text: str,
    job_role: str,
    llm,
    count: int,
) -> list[tuple[str, str]]:
    """LLM call: extract topics with source context snippets."""
    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert interview planner. Given a resume and job description, "
                "extract interview topics.\n\n"
                "RULES:\n"
                "- Extract topics that represent concrete, interviewable subjects from the resume.\n"
                "- Merge topics that represent the SAME interviewable subject, even if wording differs. "
                'For example: "server-side pagination", "95% data reduction", '
                '"replacing client-side pagination" → merge into ONE topic.\n'
                "- Do NOT merge topics from the same project that are independently useful. "
                'A project can have both "architecture decisions" and "testing strategy" as separate topics.\n'
                "- Rank by relevance to the JD:\n"
                "  1. Resume experiences directly relevant to the JD\n"
                "  2. Resume skills/projects with transferable value\n"
                "  3. JD requirements the candidate can reasonably demonstrate\n"
                "  4. General role-related areas (only if insufficient material above)\n"
                "- Each topic should be a concise, specific, interviewable subject (3-10 words).\n"
                "- Avoid vague categories like 'skills' or 'projects'.\n"
                f"- Return exactly {count} topics or fewer if not enough material exists.\n\n"
                'Return ONLY valid JSON: {"topics": [{"label": "topic1", "context": "1-2 sentence snippet from resume explaining this topic"}, ...]}'
            ),
        },
        {
            "role": "user",
            "content": (
                f"Job Role: {job_role}\n\n"
                f"Resume:\n{resume_text}\n\n"
                f"Job Description:\n{jd_text}\n\n"
                f"Extract {count} deduplicated, ranked interview topics with source context."
            ),
        },
    ]

    raw = await llm._chat(messages, max_tokens=1536)
    data = llm._parse_json(raw)

    topics = data.get("topics", [])
    if isinstance(topics, list) and len(topics) > 0:
        result = []
        for t in topics:
            if isinstance(t, dict):
                label = t.get("label", "").strip()
                context = t.get("context", "").strip()
            else:
                label = str(t).strip()
                context = ""
            if label and len(label) > 2:
                result.append((label, context[:200]))
        if result:
            return result[:count]

    # Fallback: extract any quoted strings
    import re
    matches = re.findall(r'"([^"]{3,80})"', raw)
    if matches:
        return [(m, "") for m in matches[:count]]

    return [(f"{job_role} experience", ""), ("technical skills", ""), ("projects", "")]


async def _merge_duplicate_topics(
    topics: list[TopicEntry],
    rag,
) -> list[TopicEntry]:
    """Merge topics with high embedding similarity.

    Embeds "label: source_context" (not bare labels) so the model has
    grounding context to judge semantic equivalence.
    Merges chunk_ids into the survivor.
    """
    if len(topics) <= 1:
        return topics

    # Build embed inputs: "label: source_context" for each topic
    embed_inputs = [
        f"{t.label}: {t.source_context[:200]}" if t.source_context else t.label
        for t in topics
    ]

    try:
        embeddings = await rag.get_embeddings(embed_inputs, task="retrieval.query")
    except Exception as e:
        logger.warning("[TOPIC_PLAN] Embedding merge failed, skipping: %s", e)
        return topics

    # Pairwise cosine similarity via dot product (embeddings are normalized by Jina)
    embed_matrix = np.array(embeddings, dtype=np.float32)
    norms = np.linalg.norm(embed_matrix, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1, norms)
    embed_matrix = embed_matrix / norms
    sim_matrix = np.dot(embed_matrix, embed_matrix.T)

    # Greedy merge: iterate by descending similarity, skip already-merged
    merged_indices: set[int] = set()
    result: list[TopicEntry] = []

    for i in range(len(topics)):
        if i in merged_indices:
            continue
        survivor = topics[i]
        for j in range(i + 1, len(topics)):
            if j in merged_indices:
                continue
            if sim_matrix[i][j] >= MERGE_THRESHOLD:
                # Merge: keep survivor, absorb duplicate's chunk_ids
                merged_indices.add(j)
                survivor.chunk_ids = list(set(survivor.chunk_ids + topics[j].chunk_ids))
                logger.info(
                    "[TOPIC_PLAN] Merged '%s' into '%s' (sim=%.3f)",
                    topics[j].label, survivor.label, sim_matrix[i][j],
                )
        result.append(survivor)

    # Renumber priorities after merge
    for i, t in enumerate(result):
        t.priority = i + 1

    if len(result) < len(topics):
        logger.info(
            "[TOPIC_PLAN] Merge reduced %d topics → %d",
            len(topics), len(result),
        )

    return result
