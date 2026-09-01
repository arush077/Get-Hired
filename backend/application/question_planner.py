import logging
from dataclasses import dataclass, field

import numpy as np

from domain.question import QuestionType
from domain.topic import TopicEntry, TopicStatus

logger = logging.getLogger(__name__)

MAX_QUESTIONS_PER_TOPIC = 2
DEDUP_THRESHOLD = 0.85


@dataclass
class PlannerContext:
    """Minimal context passed to question generation."""
    interview_id: str
    job_role: str
    candidate_name: str
    current_topic: TopicEntry | None
    questions_answered: int
    total_questions: int
    questions_remaining: int
    unvisited_topics: list[TopicEntry]
    previous_questions: list[str]
    previous_qa: list[dict]


class QuestionPlanner:

    def __init__(self):
        self._asked_embeddings: list[np.ndarray] = []

    def reset_embeddings(self):
        """Reset per-interview embedding cache."""
        self._asked_embeddings = []

    def apply_hard_rules(
        self,
        classification: dict,
        topic_plan: list[TopicEntry],
        current_topic: TopicEntry | None,
        questions_answered: int,
        total_questions: int,
    ) -> dict:
        """Python enforces budget, topic exhaustion, max per topic."""
        answer_status = classification["answer_status"]
        next_action = classification["next_action"]

        # NEEDS_CLARIFICATION always forces CLARIFY
        if answer_status == "NEEDS_CLARIFICATION":
            return {**classification, "next_action": "CLARIFY"}

        # DOES_NOT_KNOW always forces NEW_TOPIC and exhausts topic
        if answer_status == "DOES_NOT_KNOW":
            if current_topic:
                current_topic.status = TopicStatus.EXHAUSTED
                current_topic.exhaustion_reason = "DOES_NOT_KNOW"
            return {**classification, "next_action": "NEW_TOPIC"}

        # Max questions per topic reached → exhaust and force NEW_TOPIC
        if current_topic and current_topic.questions_asked >= MAX_QUESTIONS_PER_TOPIC:
            current_topic.status = TopicStatus.EXHAUSTED
            current_topic.exhaustion_reason = "MAX_QUESTIONS_REACHED"
            return {**classification, "next_action": "NEW_TOPIC"}

        # Budget check: if questions_remaining <= unvisited_topics, no follow-ups allowed
        questions_remaining = total_questions - questions_answered
        unvisited = [t for t in topic_plan if t.status == TopicStatus.AVAILABLE]
        if questions_remaining <= len(unvisited) and next_action == "FOLLOW_UP":
            return {**classification, "next_action": "NEW_TOPIC"}

        # If no unvisited topics remain, force NEW_TOPIC (will complete if budget exhausted)
        if not unvisited and next_action == "FOLLOW_UP":
            return {**classification, "next_action": "NEW_TOPIC"}

        return classification

    def advance_topic(
        self,
        topic_plan: list[TopicEntry],
        current_topic_id: str | None,
    ) -> str | None:
        """Mark current topic as done, return next AVAILABLE topic_id or None."""
        available = [t for t in topic_plan if t.status == TopicStatus.AVAILABLE]
        if available:
            return available[0].id
        return None

    def select_topic(
        self,
        topic_plan: list[TopicEntry],
        suggested_id: str | None = None,
    ) -> TopicEntry | None:
        """Select next topic, preferring LLM's suggestion if valid.

        Falls back to priority order if suggestion is invalid.
        """
        available = {t.id: t for t in topic_plan if t.status == TopicStatus.AVAILABLE}

        if suggested_id and suggested_id in available:
            return available[suggested_id]

        # Fallback: highest priority (lowest number) available topic
        if available:
            return min(available.values(), key=lambda t: t.priority)

        return None

    async def dedup_and_cache_question(
        self,
        question_text: str,
        q_type: QuestionType,
        embed_fn,
    ) -> tuple[str, QuestionType, np.ndarray | None]:
        """Check dedup, embed question, cache embedding. Returns (question, type, embedding).

        Reuses the dedup embedding for caching — no duplicate Jina call.
        """
        new_emb = await self._embed_question(question_text, embed_fn)

        if new_emb is not None and self._is_duplicate(new_emb):
            logger.warning(
                "[PLANNER] Duplicate question detected, but using it as fallback",
            )

        if new_emb is not None:
            self._asked_embeddings.append(new_emb)

        return question_text, q_type, new_emb

    async def _embed_question(self, question_text: str, embed_fn) -> np.ndarray | None:
        """Embed a question for dedup/caching. Single Jina call."""
        try:
            emb_result = await embed_fn([question_text], task="retrieval.query")
            if emb_result:
                return np.array(emb_result[0], dtype=np.float32)
        except Exception:
            pass
        return None

    def _is_duplicate(self, new_emb: np.ndarray) -> bool:
        """Check if embedding is too similar to previously asked questions."""
        if not self._asked_embeddings:
            return False

        new_norm = np.linalg.norm(new_emb)
        if new_norm == 0:
            return False
        new_emb_normalized = new_emb / new_norm

        asked_matrix = np.stack(self._asked_embeddings)
        asked_norms = np.linalg.norm(asked_matrix, axis=1)
        asked_norms = np.where(asked_norms == 0, 1, asked_norms)
        asked_matrix_normed = asked_matrix / asked_norms[:, np.newaxis]

        sims = np.dot(asked_matrix_normed, new_emb_normalized)
        return bool(sims.max() >= DEDUP_THRESHOLD)

    async def _check_duplicate(self, new_question: str, embed_fn) -> bool:
        """Embedding cosine similarity check. Returns True if duplicate. (Legacy method for tests.)"""
        if not self._asked_embeddings:
            return False

        try:
            emb_result = await embed_fn([new_question], task="retrieval.query")
            if not emb_result:
                return False
            new_emb = np.array(emb_result[0], dtype=np.float32)
        except Exception:
            return False

        return self._is_duplicate(new_emb)
