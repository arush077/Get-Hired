import logging
from dataclasses import dataclass, field

import numpy as np

from domain.question import QuestionType
from domain.topic import TopicEntry, TopicStatus

logger = logging.getLogger(__name__)

MAX_QUESTIONS_PER_TOPIC = 2
MAX_GENERATION_RETRIES = 2
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
        self._topic_chunk_cache: dict[tuple[str, str], list[str]] = {}
        self._doc_ids_cache: dict[str, list] = {}

    def reset_embeddings(self):
        """Reset per-interview embedding cache."""
        self._asked_embeddings = []

    def get_cached_chunks(self, interview_id: str, topic_id: str | None) -> list[str] | None:
        """Get cached RAG chunks for a topic. Returns None if not cached."""
        if not topic_id:
            return []
        return self._topic_chunk_cache.get((interview_id, topic_id))

    def cache_chunks(self, interview_id: str, topic_id: str, chunks: list[str]):
        """Cache RAG chunks for a topic."""
        self._topic_chunk_cache[(interview_id, topic_id)] = chunks

    def get_cached_doc_ids(self, interview_id: str) -> list | None:
        """Get cached document IDs for an interview. Returns None if not cached."""
        return self._doc_ids_cache.get(interview_id)

    def cache_doc_ids(self, interview_id: str, doc_ids: list):
        """Cache document IDs for an interview."""
        self._doc_ids_cache[interview_id] = doc_ids

    async def classify_and_generate(
        self,
        context: PlannerContext,
        question: str,
        answer: str,
        cached_chunks: list[str] | None,
        llm,
    ) -> dict:
        """Unified LLM call: classify + decide + generate question for same-topic turns.

        For same-topic follow-up and clarification, this is the ONLY LLM call.
        For NEW_TOPIC, returns decision only — Python handles topic selection + separate generation.
        """
        questions_on_topic = context.current_topic.questions_asked if context.current_topic else 0
        topics_remaining = [t.label for t in context.unvisited_topics]

        # For same-topic turns, we can generate the follow-up question in the same call
        # For NEW_TOPIC, don't generate question — Python selects topic first
        should_generate = True
        question_type = "FOLLOW_UP"

        if context.questions_answered < 2:
            # HR questions are simple enough to generate separately (no RAG needed)
            # But classify first, then generate HR question
            should_generate = False

        return await llm.classify_and_generate_next(
            job_role=context.job_role,
            current_question=question,
            candidate_answer=answer,
            current_topic=context.current_topic.label if context.current_topic else "",
            questions_on_topic=questions_on_topic,
            topics_remaining=topics_remaining,
            context_chunks=cached_chunks if cached_chunks is not None else [],
            interview_history=context.previous_qa,
            previously_asked_questions=context.previous_questions,
            should_generate_question=should_generate,
            question_type=question_type,
        )

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

    async def generate_question_for_topic(
        self,
        context: PlannerContext,
        topic_chunks: list[str],
        llm,
    ) -> tuple[str, QuestionType]:
        """Generate a PRIMARY question for a new topic using cached chunks."""
        q_type = QuestionType.PRIMARY

        question_text = await llm.generate_primary_question(
            job_role=context.job_role,
            search_angle=context.current_topic.label if context.current_topic else context.job_role,
            context_chunks=topic_chunks,
            previously_asked_questions=context.previous_questions,
        )

        return question_text, q_type

    async def generate_hr_question(
        self,
        context: PlannerContext,
        llm,
    ) -> tuple[str, QuestionType]:
        """Generate an HR question (no RAG needed)."""
        variant = "introductory" if context.questions_answered == 0 else "motivational"
        question_text = await llm.generate_hr_question(
            candidate_name=context.candidate_name,
            job_role=context.job_role,
            variant=variant,
        )
        return question_text, QuestionType.HR

    async def dedup_and_cache_question(
        self,
        question_text: str,
        q_type: QuestionType,
        rag,
    ) -> tuple[str, QuestionType, np.ndarray | None]:
        """Check dedup, embed question, cache embedding. Returns (question, type, embedding).

        Reuses the dedup embedding for caching — no duplicate Jina call.
        """
        # Embed the question once for both dedup and caching
        new_emb = await self._embed_question(question_text, rag)

        # Dedup check
        if new_emb is not None and self._is_duplicate(new_emb):
            logger.warning(
                "[PLANNER] Duplicate question detected, but using it as fallback",
            )

        # Cache the embedding
        if new_emb is not None:
            self._asked_embeddings.append(new_emb)

        return question_text, q_type, new_emb

    async def _embed_question(self, question_text: str, rag) -> np.ndarray | None:
        """Embed a question for dedup/caching. Single Jina call."""
        try:
            emb_result = await rag.get_embeddings([question_text], task="retrieval.query")
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

    async def _check_duplicate(self, new_question: str, rag) -> bool:
        """Embedding cosine similarity check. Returns True if duplicate. (Legacy method for tests.)"""
        if not self._asked_embeddings:
            return False

        try:
            emb_result = await rag.get_embeddings([new_question], task="retrieval.query")
            if not emb_result:
                return False
            new_emb = np.array(emb_result[0], dtype=np.float32)
        except Exception:
            return False

        return self._is_duplicate(new_emb)
