import logging
import re
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

    def reset_embeddings(self):
        """Reset per-interview embedding cache."""
        self._asked_embeddings = []

    async def classify_and_plan(
        self,
        context: PlannerContext,
        question: str,
        answer: str,
        rag_chunks: list[str],
        llm,
    ) -> dict:
        """Single LLM call: answer_status + next_action + optional clarification."""
        questions_on_topic = context.current_topic.questions_asked if context.current_topic else 0
        topics_remaining = [t.label for t in context.unvisited_topics]

        return llm.classify_and_plan_next(
            job_role=context.job_role,
            current_question=question,
            candidate_answer=answer,
            current_topic=context.current_topic.label if context.current_topic else "",
            questions_on_topic=questions_on_topic,
            topics_remaining=topics_remaining,
            context_chunks=rag_chunks,
            interview_history=context.previous_qa,
            previously_asked_questions=context.previous_questions,
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
        # Find next AVAILABLE topic by priority
        available = [t for t in topic_plan if t.status == TopicStatus.AVAILABLE]
        if available:
            return available[0].id
        return None

    async def generate_question(
        self,
        context: PlannerContext,
        rag,
        llm,
    ) -> tuple[str, QuestionType]:
        """Generate question for current topic with dedup check."""
        # Determine question type
        if context.questions_answered < 2:
            q_type = QuestionType.HR
        elif context.previous_qa and context.questions_remaining > len(context.unvisited_topics):
            # Budget allows follow-up if we have spare slots
            last_qa = context.previous_qa[-1]
            q_type = QuestionType.FOLLOW_UP
        else:
            q_type = QuestionType.PRIMARY

        for attempt in range(MAX_GENERATION_RETRIES):
            if q_type == QuestionType.HR:
                variant = "introductory" if context.questions_answered == 0 else "motivational"
                question_text = llm.generate_hr_question(
                    candidate_name=context.candidate_name,
                    job_role=context.job_role,
                    variant=variant,
                )
                return question_text, q_type

            if q_type == QuestionType.FOLLOW_UP and context.previous_qa:
                last_qa = context.previous_qa[-1]
                # RAG retrieval uses candidate's answer as primary query
                answer_text = last_qa["answer"]
                if len(answer_text) > 500:
                    answer_text = answer_text[:500] + "..."
                raw_chunks = await rag.retrieve(
                    query=answer_text,
                    interview_id=context.interview_id,
                    top_k=3,
                )
                chunks = [c.content for c in raw_chunks]

                question_text = llm.generate_follow_up_question(
                    job_role=context.job_role,
                    previous_question=last_qa["question"],
                    previous_answer=last_qa["answer"],
                    context_chunks=chunks,
                    topic_label=context.current_topic.label if context.current_topic else "",
                )
            else:
                # PRIMARY: RAG retrieval uses topic label as query
                if context.current_topic:
                    raw_chunks = await rag.retrieve(
                        query=context.current_topic.label,
                        interview_id=context.interview_id,
                        top_k=3,
                    )
                    chunks = [c.content for c in raw_chunks]
                else:
                    chunks = []

                question_text = llm.generate_primary_question(
                    job_role=context.job_role,
                    search_angle=context.current_topic.label if context.current_topic else context.job_role,
                    context_chunks=chunks,
                    previously_asked_questions=context.previous_questions,
                )

            # Dedup check: embedding cosine similarity
            if not await self._check_duplicate(question_text, rag):
                # Cache the embedding for this accepted question
                try:
                    emb = await rag.get_embeddings([question_text], task="retrieval.query")
                    if emb:
                        self._asked_embeddings.append(np.array(emb[0], dtype=np.float32))
                except Exception:
                    pass
                return question_text, q_type

            logger.warning(
                "[PLANNER] Duplicate question detected (attempt %d), retrying",
                attempt + 1,
            )
            # On retry, switch to PRIMARY if was FOLLOW_UP
            if q_type == QuestionType.FOLLOW_UP:
                q_type = QuestionType.PRIMARY

        # Fallback: return the last generated question even if similar
        return question_text, q_type

    async def _check_duplicate(self, new_question: str, rag) -> bool:
        """Embedding cosine similarity check. Returns True if duplicate."""
        if not self._asked_embeddings:
            return False

        try:
            emb_result = await rag.get_embeddings([new_question], task="retrieval.query")
            if not emb_result:
                return False
            new_emb = np.array(emb_result[0], dtype=np.float32)
        except Exception:
            return False

        new_norm = np.linalg.norm(new_emb)
        if new_norm == 0:
            return False
        new_emb = new_emb / new_norm

        asked_matrix = np.stack(self._asked_embeddings)
        asked_norms = np.linalg.norm(asked_matrix, axis=1)
        asked_norms = np.where(asked_norms == 0, 1, asked_norms)
        asked_matrix = asked_matrix / asked_norms[:, np.newaxis]

        sims = np.dot(asked_matrix, new_emb)
        return bool(sims.max() >= DEDUP_THRESHOLD)
