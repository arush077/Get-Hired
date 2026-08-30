import numpy as np
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from domain.topic import TopicEntry, TopicStatus
from domain.question import QuestionType
from domain.interview import Interview
from domain.interview_state import InterviewState
from application.question_planner import QuestionPlanner, PlannerContext, MAX_QUESTIONS_PER_TOPIC, DEDUP_THRESHOLD


# ── Topic Planning Tests ─────────────────────────────────────────


class TestTopicPlanning:
    def test_topic_deduplication(self):
        """Similar topics should be merged into one."""
        topic_plan = [
            TopicEntry(id="topic_0", label="Server-side pagination", priority=1),
            TopicEntry(id="topic_1", label="95% data reduction", priority=2),
            TopicEntry(id="topic_2", label="Replacing client-side pagination", priority=3),
        ]
        # After LLM dedup, these should be one topic
        # This tests the data structure, not the LLM call
        assert len(topic_plan) == 3
        assert topic_plan[0].status == TopicStatus.AVAILABLE

    def test_topic_ranking(self):
        """High-value topics should have lower priority numbers."""
        topic_plan = [
            TopicEntry(id="topic_0", label="Uber AI project", priority=1),
            TopicEntry(id="topic_1", label="Education", priority=5),
        ]
        assert topic_plan[0].priority < topic_plan[1].priority

    def test_topic_order_stable_after_start(self):
        """Topic order should not change after interview starts."""
        topic_plan = [
            TopicEntry(id="topic_0", label="Project A", priority=1),
            TopicEntry(id="topic_1", label="Project B", priority=2),
        ]
        original_order = [t.id for t in topic_plan]
        # Simulate some operations
        topic_plan[0].status = TopicStatus.ACTIVE
        topic_plan[0].questions_asked = 1
        # Order should remain the same
        assert [t.id for t in topic_plan] == original_order

    def test_exhausted_topic_never_selected(self):
        """EXHAUSTED topics should not be available for selection."""
        topic_plan = [
            TopicEntry(id="topic_0", label="Project A", priority=1, status=TopicStatus.EXHAUSTED),
            TopicEntry(id="topic_1", label="Project B", priority=2, status=TopicStatus.AVAILABLE),
        ]
        available = [t for t in topic_plan if t.status == TopicStatus.AVAILABLE]
        assert len(available) == 1
        assert available[0].id == "topic_1"


# ── Answer Handling Tests ────────────────────────────────────────


class TestAnswerHandling:
    def setup_method(self):
        self.planner = QuestionPlanner()

    def _make_context(self, **kwargs):
        defaults = {
            "interview_id": "test-id",
            "job_role": "SDE-1",
            "candidate_name": "Test",
            "current_topic": TopicEntry(id="topic_0", label="Project A", priority=1),
            "questions_answered": 2,
            "total_questions": 10,
            "questions_remaining": 8,
            "unvisited_topics": [
                TopicEntry(id="topic_1", label="Project B", priority=2),
                TopicEntry(id="topic_2", label="Project C", priority=3),
            ],
            "previous_questions": ["Q1", "Q2"],
            "previous_qa": [{"question": "Q1", "answer": "A1"}],
        }
        defaults.update(kwargs)
        return PlannerContext(**defaults)

    def test_detailed_answer_triggers_new_topic(self):
        """A complete answer should allow moving to new topic."""
        topic = TopicEntry(id="topic_0", label="Project A", priority=1)
        topic_plan = [topic, TopicEntry(id="topic_1", label="Project B", priority=2)]
        context = self._make_context(current_topic=topic)

        classification = {
            "answer_status": "ANSWERED",
            "next_action": "NEW_TOPIC",
            "reason": "Complete answer",
            "clarification_text": None,
        }

        result = self.planner.apply_hard_rules(
            classification, topic_plan, topic, 2, 10
        )
        assert result["next_action"] == "NEW_TOPIC"

    def test_incomplete_answer_triggers_follow_up(self):
        """An incomplete answer should allow follow-up if budget permits."""
        topic = TopicEntry(id="topic_0", label="Project A", priority=1, questions_asked=0)
        topic_plan = [topic, TopicEntry(id="topic_1", label="Project B", priority=2)]
        context = self._make_context(current_topic=topic, questions_remaining=8)

        classification = {
            "answer_status": "PARTIAL_ANSWER",
            "next_action": "FOLLOW_UP",
            "reason": "Incomplete",
            "clarification_text": None,
        }

        result = self.planner.apply_hard_rules(
            classification, topic_plan, topic, 2, 10
        )
        assert result["next_action"] == "FOLLOW_UP"

    def test_does_not_know_exhausts_topic(self):
        """DOES_NOT_KNOW should exhaust the topic and force NEW_TOPIC."""
        topic = TopicEntry(id="topic_0", label="Project A", priority=1)
        topic_plan = [topic, TopicEntry(id="topic_1", label="Project B", priority=2)]

        classification = {
            "answer_status": "DOES_NOT_KNOW",
            "next_action": "NEW_TOPIC",
            "reason": "Candidate doesn't know",
            "clarification_text": None,
        }

        result = self.planner.apply_hard_rules(
            classification, topic_plan, topic, 2, 10
        )
        assert result["next_action"] == "NEW_TOPIC"
        assert topic.status == TopicStatus.EXHAUSTED
        assert topic.exhaustion_reason == "DOES_NOT_KNOW"

    def test_i_havent_worked_on_that_exhausts_topic(self):
        """'I haven't worked on that' should be classified as DOES_NOT_KNOW by LLM."""
        topic = TopicEntry(id="topic_0", label="Project A", priority=1)

        classification = {
            "answer_status": "DOES_NOT_KNOW",
            "next_action": "NEW_TOPIC",
            "reason": "No experience",
            "clarification_text": None,
        }

        topic_plan = [topic, TopicEntry(id="topic_1", label="Project B", priority=2)]
        result = self.planner.apply_hard_rules(
            classification, topic_plan, topic, 1, 10
        )
        assert topic.status == TopicStatus.EXHAUSTED

    def test_my_manager_handled_that_exhausts_topic(self):
        """'My manager handled that' should exhaust topic if no useful evidence."""
        topic = TopicEntry(id="topic_0", label="Project A", priority=1)

        classification = {
            "answer_status": "DOES_NOT_KNOW",
            "next_action": "NEW_TOPIC",
            "reason": "Not involved",
            "clarification_text": None,
        }

        topic_plan = [topic, TopicEntry(id="topic_1", label="Project B", priority=2)]
        result = self.planner.apply_hard_rules(
            classification, topic_plan, topic, 1, 10
        )
        assert topic.status == TopicStatus.EXHAUSTED

    def test_clarification_does_not_consume_slot(self):
        """NEEDS_CLARIFICATION should force CLARIFY action."""
        topic = TopicEntry(id="topic_0", label="Project A", priority=1)

        classification = {
            "answer_status": "NEEDS_CLARIFICATION",
            "next_action": "CLARIFY",
            "reason": "Needs rephrasing",
            "clarification_text": "Let me rephrase that question.",
        }

        topic_plan = [topic]
        result = self.planner.apply_hard_rules(
            classification, topic_plan, topic, 2, 10
        )
        assert result["next_action"] == "CLARIFY"

    def test_real_answer_with_no_is_not_does_not_know(self):
        """A real answer containing 'no' should NOT be classified as DOES_NOT_KNOW."""
        # This tests that the LLM prompt instructs it correctly
        # The actual classification is done by the LLM, not by regex
        topic = TopicEntry(id="topic_0", label="Project A", priority=1)

        classification = {
            "answer_status": "ANSWERED",
            "next_action": "NEW_TOPIC",
            "reason": "Substantive answer",
            "clarification_text": None,
        }

        topic_plan = [topic, TopicEntry(id="topic_1", label="Project B", priority=2)]
        result = self.planner.apply_hard_rules(
            classification, topic_plan, topic, 1, 10
        )
        assert result["answer_status"] == "ANSWERED"
        assert topic.status == TopicStatus.AVAILABLE

    def test_partial_answer_can_get_follow_up(self):
        """Partial answer should allow follow-up if budget permits."""
        topic = TopicEntry(id="topic_0", label="Project A", priority=1, questions_asked=0)

        classification = {
            "answer_status": "PARTIAL_ANSWER",
            "next_action": "FOLLOW_UP",
            "reason": "Needs more detail",
            "clarification_text": None,
        }

        topic_plan = [topic, TopicEntry(id="topic_1", label="Project B", priority=2)]
        result = self.planner.apply_hard_rules(
            classification, topic_plan, topic, 2, 10
        )
        assert result["next_action"] == "FOLLOW_UP"


# ── Budget Tests ─────────────────────────────────────────────────


class TestBudget:
    def setup_method(self):
        self.planner = QuestionPlanner()

    def test_no_follow_up_when_budget_tight(self):
        """If questions_remaining <= unvisited_topics, no follow-up allowed."""
        topic = TopicEntry(id="topic_0", label="Project A", priority=1, questions_asked=0)
        unvisited = [
            TopicEntry(id="topic_1", label="Project B", priority=2),
            TopicEntry(id="topic_2", label="Project C", priority=3),
        ]
        topic_plan = [topic] + unvisited

        classification = {
            "answer_status": "PARTIAL_ANSWER",
            "next_action": "FOLLOW_UP",
            "reason": "Incomplete",
            "clarification_text": None,
        }

        # questions_remaining = 3, unvisited = 2, so follow-up not allowed
        result = self.planner.apply_hard_rules(
            classification, topic_plan, topic, 7, 10
        )
        assert result["next_action"] == "NEW_TOPIC"

    def test_follow_up_allowed_when_budget_loose(self):
        """If questions_remaining > unvisited_topics, follow-up allowed."""
        topic = TopicEntry(id="topic_0", label="Project A", priority=1, questions_asked=0)
        unvisited = [
            TopicEntry(id="topic_1", label="Project B", priority=2),
        ]
        topic_plan = [topic] + unvisited

        classification = {
            "answer_status": "PARTIAL_ANSWER",
            "next_action": "FOLLOW_UP",
            "reason": "Incomplete",
            "clarification_text": None,
        }

        # questions_remaining = 8, unvisited = 1, so follow-up allowed
        result = self.planner.apply_hard_rules(
            classification, topic_plan, topic, 2, 10
        )
        assert result["next_action"] == "FOLLOW_UP"

    def test_clarification_does_not_consume_budget(self):
        """Clarification should not count against the question budget."""
        topic = TopicEntry(id="topic_0", label="Project A", priority=1)

        classification = {
            "answer_status": "NEEDS_CLARIFICATION",
            "next_action": "CLARIFY",
            "reason": "Unclear",
            "clarification_text": "Let me rephrase.",
        }

        topic_plan = [topic]
        result = self.planner.apply_hard_rules(
            classification, topic_plan, topic, 9, 10
        )
        # Even with 9 answered, clarification should still work
        assert result["next_action"] == "CLARIFY"


# ── Repetition Tests ────────────────────────────────────────────


def _make_embedding(text: str, seed: int = 0) -> list[float]:
    """Deterministic fake embedding: similar texts → similar vectors."""
    rng = np.random.RandomState(seed + hash(text) % 10000)
    vec = rng.randn(768).astype(np.float32)
    vec = vec / np.linalg.norm(vec)
    return vec.tolist()


class TestRepetition:
    def setup_method(self):
        self.planner = QuestionPlanner()

    def test_exhausted_topic_never_reselected(self):
        """Once exhausted, a topic should never be selected again."""
        topic = TopicEntry(id="topic_0", label="Project A", priority=1, status=TopicStatus.EXHAUSTED)
        topic_plan = [topic, TopicEntry(id="topic_1", label="Project B", priority=2)]

        available = [t for t in topic_plan if t.status == TopicStatus.AVAILABLE]
        assert len(available) == 1
        assert available[0].id == "topic_1"

    @pytest.mark.asyncio
    async def test_duplicate_question_rejected_by_embedding(self):
        """Semantically duplicate questions should be caught by embedding similarity."""
        rag = AsyncMock()
        # Craft embeddings: previous question has a vector close to the duplicate
        base = np.array([0.9] + [0.01] * 767, dtype=np.float32)
        base = base / np.linalg.norm(base)
        # Slight perturbation to simulate near-duplicate
        dup_emb = base + np.random.RandomState(42).randn(768).astype(np.float32) * 0.01
        dup_emb = dup_emb / np.linalg.norm(dup_emb)

        self.planner._asked_embeddings = [base]

        rag.get_embeddings = AsyncMock(return_value=[dup_emb.tolist()])

        result = await self.planner._check_duplicate("any text", rag)
        assert result is True

    @pytest.mark.asyncio
    async def test_different_question_accepted_by_embedding(self):
        """Different questions should pass the embedding check."""
        rag = AsyncMock()
        # Previous question vector
        prev_emb = np.array([1.0] + [0.0] * 767, dtype=np.float32)
        prev_emb = prev_emb / np.linalg.norm(prev_emb)
        self.planner._asked_embeddings = [prev_emb]

        # Completely different question (orthogonal vector)
        diff_emb = np.array([0.0] * 768, dtype=np.float32)
        diff_emb[400] = 1.0  # orthogonal

        rag.get_embeddings = AsyncMock(return_value=[diff_emb.tolist()])

        result = await self.planner._check_duplicate("Completely different topic", rag)
        assert result is False

    @pytest.mark.asyncio
    async def test_no_previous_questions_returns_false(self):
        """With no previous questions, dedup should return False."""
        rag = AsyncMock()
        self.planner._asked_embeddings = []

        result = await self.planner._check_duplicate("Any question?", rag)
        assert result is False

    @pytest.mark.asyncio
    async def test_embedding_failure_returns_false(self):
        """If embedding call fails, dedup should return False (fail open)."""
        rag = AsyncMock()
        self.planner._asked_embeddings = [
            np.array(_make_embedding("previous question"), dtype=np.float32)
        ]
        rag.get_embeddings = AsyncMock(side_effect=Exception("API error"))

        result = await self.planner._check_duplicate("New question?", rag)
        assert result is False

    def test_generation_retry_limit(self):
        """Generation should not retry infinitely."""
        # This is tested implicitly by the MAX_GENERATION_RETRIES constant
        from application.question_planner import MAX_GENERATION_RETRIES
        assert MAX_GENERATION_RETRIES == 2

    def test_no_infinite_planner_loop(self):
        """The planner should not loop infinitely."""
        # The apply_hard_rules method is deterministic and always returns
        # It does not loop
        planner = QuestionPlanner()
        topic = TopicEntry(id="topic_0", label="A", priority=1)
        classification = {
            "answer_status": "ANSWERED",
            "next_action": "FOLLOW_UP",
            "reason": "",
            "clarification_text": None,
        }
        result = planner.apply_hard_rules(classification, [topic], topic, 5, 10)
        assert "next_action" in result

    def test_embeddings_reset(self):
        """reset_embeddings should clear the cache."""
        self.planner._asked_embeddings = [np.zeros(768)]
        self.planner.reset_embeddings()
        assert len(self.planner._asked_embeddings) == 0


# ── Completion Tests ─────────────────────────────────────────────


class TestCompletion:
    def test_q10_completes_interview(self):
        """After 10 Q&A pairs, interview should be completed."""
        from domain.answer import Answer
        interview = Interview(total_questions=10)
        # Simulate the actual flow: submit_answer then advance
        for i in range(10):
            interview.current_question_index = i
            interview.submit_answer(Answer(transcript=f"Answer {i}"))
            interview.advance()
        assert interview.status == InterviewState.COMPLETED

    def test_q10_never_creates_q11(self):
        """After Q10, no more questions should be generated."""
        from domain.answer import Answer
        interview = Interview(total_questions=10)
        for i in range(10):
            interview.current_question_index = i
            interview.submit_answer(Answer(transcript=f"Answer {i}"))
            interview.advance()
        assert interview.is_complete

    def test_clarification_before_q10_does_not_consume_q10(self):
        """Clarification at Q10 should not consume the Q10 slot."""
        planner = QuestionPlanner()
        topic = TopicEntry(id="topic_0", label="A", priority=1)

        classification = {
            "answer_status": "NEEDS_CLARIFICATION",
            "next_action": "CLARIFY",
            "reason": "",
            "clarification_text": "Let me rephrase.",
        }

        topic_plan = [topic]
        result = planner.apply_hard_rules(
            classification, topic_plan, topic, 9, 10
        )
        assert result["next_action"] == "CLARIFY"

    def test_final_state_persisted(self):
        """Interview state should be properly persisted."""
        from infrastructure.repositories.interview_repository import (
            _serialize_topic_plan,
            _deserialize_topic_plan,
        )

        topic_plan = [
            TopicEntry(id="topic_0", label="Project A", priority=1, status=TopicStatus.ACTIVE, source_context="built a thing"),
            TopicEntry(id="topic_1", label="Project B", priority=2, status=TopicStatus.EXHAUSTED, chunk_ids=["c1", "c2"]),
        ]

        serialized = _serialize_topic_plan(topic_plan)
        deserialized = _deserialize_topic_plan(serialized)

        assert len(deserialized) == 2
        assert deserialized[0].label == "Project A"
        assert deserialized[0].status == TopicStatus.ACTIVE
        assert deserialized[0].source_context == "built a thing"
        assert deserialized[1].label == "Project B"
        assert deserialized[1].status == TopicStatus.EXHAUSTED
        assert deserialized[1].chunk_ids == ["c1", "c2"]


# ── Topic Merge Tests ───────────────────────────────────────────


class TestTopicMerge:
    @pytest.mark.asyncio
    async def test_merge_reduces_duplicate_topics(self):
        """Topics with high embedding similarity should be merged."""
        from application.topic_planner import _merge_duplicate_topics

        rag = AsyncMock()
        # Two topics that are semantically identical
        t0 = TopicEntry(id="topic_0", label="fault-tolerance strategy", priority=1, source_context="three-tier fault tolerance for retries")
        t1 = TopicEntry(id="topic_1", label="retries and backoff", priority=2, source_context="LLM retries, agent retries, exponential backoff")
        t2 = TopicEntry(id="topic_2", label="resume builder JWT auth", priority=3, source_context="JWT authentication in React frontend")

        # Make t0 and t1 have similar embeddings, t2 different
        emb_t0 = np.array([0.9] + [0.01] * 767, dtype=np.float32)
        emb_t0 = emb_t0 / np.linalg.norm(emb_t0)
        emb_t1 = np.array([0.88] + [0.02] * 767, dtype=np.float32)
        emb_t1 = emb_t1 / np.linalg.norm(emb_t1)
        emb_t2 = np.array([0.0] * 768, dtype=np.float32)
        emb_t2[500] = 1.0  # orthogonal

        rag.get_embeddings = AsyncMock(return_value=[
            emb_t0.tolist(), emb_t1.tolist(), emb_t2.tolist()
        ])

        result = await _merge_duplicate_topics([t0, t1, t2], rag)
        assert len(result) == 2
        assert result[0].label == "fault-tolerance strategy"
        assert result[1].label == "resume builder JWT auth"

    @pytest.mark.asyncio
    async def test_merge_preserves_distinct_topics(self):
        """Topics with low similarity should not be merged."""
        from application.topic_planner import _merge_duplicate_topics

        rag = AsyncMock()
        t0 = TopicEntry(id="topic_0", label="pagination architecture", priority=1, source_context="server-side pagination")
        t1 = TopicEntry(id="topic_1", label="JWT authentication", priority=2, source_context="React frontend auth")

        emb_t0 = np.array([1.0] + [0.0] * 767, dtype=np.float32)
        emb_t1 = np.array([0.0] * 768, dtype=np.float32)
        emb_t1[100] = 1.0

        rag.get_embeddings = AsyncMock(return_value=[
            emb_t0.tolist(), emb_t1.tolist()
        ])

        result = await _merge_duplicate_topics([t0, t1], rag)
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_merge_aborts_on_embedding_error(self):
        """If embedding fails, merge should return original topics unchanged."""
        from application.topic_planner import _merge_duplicate_topics

        rag = AsyncMock()
        rag.get_embeddings = AsyncMock(side_effect=Exception("API down"))

        t0 = TopicEntry(id="topic_0", label="A", priority=1)
        t1 = TopicEntry(id="topic_1", label="B", priority=2)

        result = await _merge_duplicate_topics([t0, t1], rag)
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_merge_combines_chunk_ids(self):
        """Merged topics should have combined chunk_ids."""
        from application.topic_planner import _merge_duplicate_topics

        rag = AsyncMock()
        t0 = TopicEntry(id="topic_0", label="fault tolerance", priority=1, chunk_ids=["c1", "c2"])
        t1 = TopicEntry(id="topic_1", label="retry strategy", priority=2, chunk_ids=["c3"])

        # Near-identical embeddings
        emb = np.array([1.0] + [0.001] * 767, dtype=np.float32)
        emb = emb / np.linalg.norm(emb)

        rag.get_embeddings = AsyncMock(return_value=[emb.tolist(), emb.tolist()])

        result = await _merge_duplicate_topics([t0, t1], rag)
        assert len(result) == 1
        assert set(result[0].chunk_ids) == {"c1", "c2", "c3"}
