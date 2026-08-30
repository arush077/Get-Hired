import json
import logging

import numpy as np

from domain.topic import TopicEntry, TopicStatus

logger = logging.getLogger(__name__)

MERGE_THRESHOLD = 0.85
MAX_TOPICS = 8


async def build_topic_plan(
    chunks: list[dict],
    job_role: str,
    llm,
    rag,
    total_questions: int,
) -> list[TopicEntry]:
    """Build a topic plan ONCE at interview start.

    Uses a single LLM call to extract topics from chunk metadata,
    then Python-side embedding similarity to merge duplicates.

    Args:
        chunks: List of {"id": str, "content": str, "document_type": str} from ingestion.
        job_role: The target job role.
        llm: LLMService instance.
        rag: RAGService instance.
        total_questions: Number of questions to plan for.
    """
    raw_topics = await _extract_topics(
        chunks=chunks,
        job_role=job_role,
        llm=llm,
        count=min(total_questions, MAX_TOPICS),
    )

    topic_plan = [
        TopicEntry(
            id=f"topic_{i}",
            label=label,
            priority=i + 1,
            status=TopicStatus.AVAILABLE,
            chunk_ids=chunk_ids,
        )
        for i, (label, chunk_ids) in enumerate(raw_topics)
    ]

    topic_plan = await _merge_duplicate_topics(topic_plan, rag)

    logger.info(
        "[TOPIC_PLAN] Built plan with %d topics: %s",
        len(topic_plan),
        [t.label for t in topic_plan],
    )
    return topic_plan


async def _extract_topics(
    chunks: list[dict],
    job_role: str,
    llm,
    count: int,
) -> list[tuple[str, list[str]]]:
    """LLM call: extract topics with associated chunk IDs.

    Returns list of (label, chunk_ids) tuples.
    """
    chunk_summary = "\n".join(
        f"[{c['id']}] ({c['document_type']}) {c['content'][:300]}"
        for c in chunks[:50]
    )

    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert interview planner. Given document chunks from a resume and job description, "
                "extract interview topics.\n\n"
                "RULES:\n"
                "- Extract topics that represent concrete, interviewable subjects.\n"
                "- Merge topics that represent the SAME interviewable subject, even if wording differs.\n"
                "- Do NOT merge topics from the same project that are independently useful.\n"
                "- Rank by relevance to the job role.\n"
                "- Each topic should be a concise, specific, interviewable subject (3-10 words).\n"
                "- Avoid vague categories like 'skills' or 'projects'.\n"
                f"- Return at most {count} topics.\n"
                "- Each topic MUST reference 1-3 chunk IDs from the provided list.\n\n"
                "Return ONLY valid JSON: "
                '{"topics": [{"label": "topic1", "chunk_ids": ["chunk_id_1", ...]}, ...]}'
            ),
        },
        {
            "role": "user",
            "content": (
                f"Job Role: {job_role}\n\n"
                f"Document Chunks:\n{chunk_summary}\n\n"
                f"Extract {count} deduplicated, ranked interview topics with chunk IDs."
            ),
        },
    ]

    raw = await llm._chat(messages, max_tokens=4096)
    data = llm._parse_json(raw)

    topics = data.get("topics", [])
    valid_chunk_ids = {c["id"] for c in chunks}

    if isinstance(topics, list) and len(topics) > 0:
        result = []
        for t in topics:
            if isinstance(t, dict):
                label = t.get("label", "").strip()
                raw_ids = t.get("chunk_ids", [])
                chunk_ids = [cid for cid in raw_ids if cid in valid_chunk_ids][:3]
            else:
                label = str(t).strip()
                chunk_ids = []
            if label and len(label) > 2:
                result.append((label, chunk_ids))
        if result:
            return result[:count]

    # Fallback: extract any quoted strings as labels with empty chunk_ids
    import re
    matches = re.findall(r'"([^"]{3,80})"', raw)
    if matches:
        return [(m, []) for m in matches[:count]]

    return [(f"{job_role} experience", []), ("technical skills", []), ("projects", [])]


async def _merge_duplicate_topics(
    topics: list[TopicEntry],
    rag,
) -> list[TopicEntry]:
    """Merge topics with high embedding similarity.

    Uses Python embedding similarity as a safety net for topics the LLM
    failed to merge. Unions chunk_ids on merge.
    """
    if len(topics) <= 1:
        return topics

    embed_inputs = [t.label for t in topics]

    try:
        embeddings = await rag.get_embeddings(embed_inputs, task="retrieval.query")
    except Exception as e:
        logger.warning("[TOPIC_PLAN] Embedding merge failed, skipping: %s", e)
        return topics

    embed_matrix = np.array(embeddings, dtype=np.float32)
    norms = np.linalg.norm(embed_matrix, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1, norms)
    embed_matrix = embed_matrix / norms
    sim_matrix = np.dot(embed_matrix, embed_matrix.T)

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
                merged_indices.add(j)
                survivor.chunk_ids = list(set(survivor.chunk_ids + topics[j].chunk_ids))
                logger.info(
                    "[TOPIC_PLAN] Merged '%s' into '%s' (sim=%.3f)",
                    topics[j].label, survivor.label, sim_matrix[i][j],
                )
        result.append(survivor)

    for i, t in enumerate(result):
        t.priority = i + 1

    if len(result) < len(topics):
        logger.info(
            "[TOPIC_PLAN] Merge reduced %d topics → %d",
            len(topics), len(result),
        )

    return result
