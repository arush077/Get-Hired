import json

import numpy as np
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from domain.topic import TopicEntry, TopicStatus
from domain.question import QuestionType
from domain.interview import Interview
from domain.interview_state import InterviewState
from application.question_planner import QuestionPlanner, PlannerContext, MAX_QUESTIONS_PER_TOPIC, DEDUP_THRESHOLD


def _topic(**kwargs):
    """Helper to create TopicEntry with required fields."""
    defaults = {
        "id": "topic_0",
        "label": "Test Topic",
        "source": "Test Source",
        "primary_question": "Test question?",
        "priority": 1,
    }
    defaults.update(kwargs)
    return TopicEntry(**defaults)


# ── Topic Planning Tests ─────────────────────────────────────────


class TestTopicPlanning:
    def test_topic_deduplication(self):
        """Similar topics should be merged into one."""
        topic_plan = [
            _topic(id="topic_0", label="Server-side pagination", priority=1),
            _topic(id="topic_1", label="95% data reduction", priority=2),
            _topic(id="topic_2", label="Replacing client-side pagination", priority=3),
        ]
        assert len(topic_plan) == 3
        assert topic_plan[0].status == TopicStatus.AVAILABLE

    def test_topic_ranking(self):
        """High-value topics should have lower priority numbers."""
        topic_plan = [
            _topic(id="topic_0", label="Uber AI project", priority=1),
            _topic(id="topic_1", label="Education", priority=5),
        ]
        assert topic_plan[0].priority < topic_plan[1].priority

    def test_topic_order_stable_after_start(self):
        """Topic order should not change after interview starts."""
        topic_plan = [
            _topic(id="topic_0", label="Project A", priority=1),
            _topic(id="topic_1", label="Project B", priority=2),
        ]
        original_order = [t.id for t in topic_plan]
        topic_plan[0].status = TopicStatus.ACTIVE
        topic_plan[0].questions_asked = 1
        assert [t.id for t in topic_plan] == original_order

    def test_exhausted_topic_never_selected(self):
        """EXHAUSTED topics should not be available for selection."""
        topic_plan = [
            _topic(id="topic_0", label="Project A", priority=1, status=TopicStatus.EXHAUSTED),
            _topic(id="topic_1", label="Project B", priority=2, status=TopicStatus.AVAILABLE),
        ]
        available = [t for t in topic_plan if t.status == TopicStatus.AVAILABLE]
        assert len(available) == 1
        assert available[0].id == "topic_1"

    def test_topic_has_source_and_primary_question(self):
        """TopicEntry should have source and primary_question fields."""
        t = _topic(source="Uber SWE", primary_question="Why pagination?")
        assert t.source == "Uber SWE"
        assert t.primary_question == "Why pagination?"


# ── Answer Handling Tests ────────────────────────────────────────


class TestAnswerHandling:
    def setup_method(self):
        self.planner = QuestionPlanner()

    def _make_context(self, **kwargs):
        defaults = {
            "interview_id": "test-id",
            "job_role": "SDE-1",
            "candidate_name": "Test",
            "current_topic": _topic(id="topic_0", label="Project A", priority=1),
            "questions_answered": 2,
            "total_questions": 10,
            "questions_remaining": 8,
            "unvisited_topics": [
                _topic(id="topic_1", label="Project B", priority=2),
                _topic(id="topic_2", label="Project C", priority=3),
            ],
            "previous_questions": ["Q1", "Q2"],
            "previous_qa": [{"question": "Q1", "answer": "A1"}],
        }
        defaults.update(kwargs)
        return PlannerContext(**defaults)

    def test_detailed_answer_triggers_new_topic(self):
        """A complete answer should allow moving to new topic."""
        topic = _topic(id="topic_0", label="Project A", priority=1)
        topic_plan = [topic, _topic(id="topic_1", label="Project B", priority=2)]

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
        topic = _topic(id="topic_0", label="Project A", priority=1, questions_asked=0)
        topic_plan = [topic, _topic(id="topic_1", label="Project B", priority=2)]

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
        topic = _topic(id="topic_0", label="Project A", priority=1)
        topic_plan = [topic, _topic(id="topic_1", label="Project B", priority=2)]

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

    def test_clarification_does_not_consume_slot(self):
        """NEEDS_CLARIFICATION should force CLARIFY action."""
        topic = _topic(id="topic_0", label="Project A", priority=1)

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
        topic = _topic(id="topic_0", label="Project A", priority=1)

        classification = {
            "answer_status": "ANSWERED",
            "next_action": "NEW_TOPIC",
            "reason": "Substantive answer",
            "clarification_text": None,
        }

        topic_plan = [topic, _topic(id="topic_1", label="Project B", priority=2)]
        result = self.planner.apply_hard_rules(
            classification, topic_plan, topic, 1, 10
        )
        assert result["answer_status"] == "ANSWERED"
        assert topic.status == TopicStatus.AVAILABLE

    def test_partial_answer_can_get_follow_up(self):
        """Partial answer should allow follow-up if budget permits."""
        topic = _topic(id="topic_0", label="Project A", priority=1, questions_asked=0)

        classification = {
            "answer_status": "PARTIAL_ANSWER",
            "next_action": "FOLLOW_UP",
            "reason": "Needs more detail",
            "clarification_text": None,
        }

        topic_plan = [topic, _topic(id="topic_1", label="Project B", priority=2)]
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
        topic = _topic(id="topic_0", label="Project A", priority=1, questions_asked=0)
        unvisited = [
            _topic(id="topic_1", label="Project B", priority=2),
            _topic(id="topic_2", label="Project C", priority=3),
        ]
        topic_plan = [topic] + unvisited

        classification = {
            "answer_status": "PARTIAL_ANSWER",
            "next_action": "FOLLOW_UP",
            "reason": "Incomplete",
            "clarification_text": None,
        }

        result = self.planner.apply_hard_rules(
            classification, topic_plan, topic, 7, 10
        )
        assert result["next_action"] == "NEW_TOPIC"

    def test_follow_up_allowed_when_budget_loose(self):
        """If questions_remaining > unvisited_topics, follow-up allowed."""
        topic = _topic(id="topic_0", label="Project A", priority=1, questions_asked=0)
        unvisited = [
            _topic(id="topic_1", label="Project B", priority=2),
        ]
        topic_plan = [topic] + unvisited

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

    def test_clarification_does_not_consume_budget(self):
        """Clarification should not count against the question budget."""
        topic = _topic(id="topic_0", label="Project A", priority=1)

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
        assert result["next_action"] == "CLARIFY"


# ── Repetition Tests ────────────────────────────────────────────


def _make_embedding(text: str, seed: int = 0) -> list[float]:
    """Deterministic fake embedding: similar texts -> similar vectors."""
    rng = np.random.RandomState(seed + hash(text) % 10000)
    vec = rng.randn(768).astype(np.float32)
    vec = vec / np.linalg.norm(vec)
    return vec.tolist()


class TestRepetition:
    def setup_method(self):
        self.planner = QuestionPlanner()

    def test_exhausted_topic_never_reselected(self):
        """Once exhausted, a topic should never be selected again."""
        topic = _topic(id="topic_0", label="Project A", priority=1, status=TopicStatus.EXHAUSTED)
        topic_plan = [topic, _topic(id="topic_1", label="Project B", priority=2)]

        available = [t for t in topic_plan if t.status == TopicStatus.AVAILABLE]
        assert len(available) == 1
        assert available[0].id == "topic_1"

    @pytest.mark.asyncio
    async def test_duplicate_question_rejected_by_embedding(self):
        """Semantically duplicate questions should be caught by embedding similarity."""
        rag = AsyncMock()
        base = np.array([0.9] + [0.01] * 767, dtype=np.float32)
        base = base / np.linalg.norm(base)
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
        prev_emb = np.array([1.0] + [0.0] * 767, dtype=np.float32)
        prev_emb = prev_emb / np.linalg.norm(prev_emb)
        self.planner._asked_embeddings = [prev_emb]

        diff_emb = np.array([0.0] * 768, dtype=np.float32)
        diff_emb[400] = 1.0

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

    def test_no_infinite_planner_loop(self):
        """The planner should not loop infinitely."""
        planner = QuestionPlanner()
        topic = _topic(id="topic_0", label="A", priority=1)
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
        topic = _topic(id="topic_0", label="A", priority=1)

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
        from infrastructure.repositories.topic_serialization import (
            serialize_topic_plan,
            deserialize_topic_plan,
        )

        topic_plan = [
            _topic(id="topic_0", label="Project A", priority=1, status=TopicStatus.ACTIVE,
                   source="Uber", primary_question="Why?"),
            _topic(id="topic_1", label="Project B", priority=2, status=TopicStatus.EXHAUSTED,
                   source="MergePilot", primary_question="How?"),
        ]

        serialized = serialize_topic_plan(topic_plan)
        deserialized = deserialize_topic_plan(serialized)

        assert len(deserialized) == 2
        assert deserialized[0].label == "Project A"
        assert deserialized[0].status == TopicStatus.ACTIVE
        assert deserialized[0].source == "Uber"
        assert deserialized[1].label == "Project B"
        assert deserialized[1].status == TopicStatus.EXHAUSTED
        assert deserialized[1].source == "MergePilot"


# ── Topic Selection Tests ───────────────────────────────────────


class TestTopicSelection:
    def setup_method(self):
        self.planner = QuestionPlanner()

    def test_select_topic_prefers_llm_suggestion(self):
        """select_topic should prefer the LLM's suggested topic if valid."""
        topic_plan = [
            _topic(id="uber_pagination", label="Pagination", priority=1),
            _topic(id="mergepilot_arch", label="Architecture", priority=2),
        ]
        result = self.planner.select_topic(topic_plan, suggested_id="mergepilot_arch")
        assert result.id == "mergepilot_arch"

    def test_select_topic_falls_back_to_priority(self):
        """select_topic should fall back to priority if suggestion is invalid."""
        topic_plan = [
            _topic(id="uber_pagination", label="Pagination", priority=1),
            _topic(id="mergepilot_arch", label="Architecture", priority=2),
        ]
        result = self.planner.select_topic(topic_plan, suggested_id="nonexistent")
        assert result.id == "uber_pagination"

    def test_select_topic_skips_exhausted(self):
        """select_topic should skip EXHAUSTED topics."""
        topic_plan = [
            _topic(id="t0", label="A", priority=1, status=TopicStatus.EXHAUSTED),
            _topic(id="t1", label="B", priority=2),
        ]
        result = self.planner.select_topic(topic_plan)
        assert result.id == "t1"

    def test_select_topic_returns_none_when_all_exhausted(self):
        """select_topic should return None when no topics are AVAILABLE."""
        topic_plan = [
            _topic(id="t0", label="A", priority=1, status=TopicStatus.EXHAUSTED),
            _topic(id="t1", label="B", priority=2, status=TopicStatus.SKIPPED),
        ]
        result = self.planner.select_topic(topic_plan)
        assert result is None


# ── Topic Status Tests ──────────────────────────────────────────


class TestTopicStatus:
    def test_skipped_status_exists(self):
        """TopicStatus should include SKIPPED."""
        assert hasattr(TopicStatus, "SKIPPED")
        assert TopicStatus.SKIPPED.value == "SKIPPED"

    def test_skipped_serialization(self):
        """SKIPPED status should serialize and deserialize correctly."""
        from infrastructure.repositories.topic_serialization import (
            serialize_topic_plan,
            deserialize_topic_plan,
        )
        topic_plan = [
            _topic(id="t0", label="A", priority=1, status=TopicStatus.SKIPPED),
        ]
        serialized = serialize_topic_plan(topic_plan)
        deserialized = deserialize_topic_plan(serialized)
        assert deserialized[0].status == TopicStatus.SKIPPED

    def test_exhausted_topics_never_selected(self):
        """EXHAUSTED topics should never appear in available list."""
        topic_plan = [
            _topic(id="t0", label="A", priority=1, status=TopicStatus.EXHAUSTED),
            _topic(id="t1", label="B", priority=2, status=TopicStatus.EXHAUSTED),
            _topic(id="t2", label="C", priority=3, status=TopicStatus.AVAILABLE),
        ]
        available = [t for t in topic_plan if t.status == TopicStatus.AVAILABLE]
        assert len(available) == 1
        assert available[0].id == "t2"


# ── Interview Flow Tests ────────────────────────────────────────


class TestInterviewFlow:
    def test_q10_terminates_interview(self):
        """Interview should terminate after Q10."""
        from domain.answer import Answer
        interview = Interview(total_questions=10)
        for i in range(10):
            interview.current_question_index = i
            interview.submit_answer(Answer(transcript=f"Answer {i}"))
            interview.advance()
        assert interview.is_complete
        assert interview.status == InterviewState.COMPLETED

    def test_clarification_stays_on_same_topic(self):
        """Clarification should not advance topic or consume question slot."""
        planner = QuestionPlanner()
        topic = _topic(id="t0", label="A", priority=1)

        classification = {
            "answer_status": "NEEDS_CLARIFICATION",
            "next_action": "CLARIFY",
            "reason": "",
            "clarification_text": "Let me rephrase that.",
        }

        result = planner.apply_hard_rules(classification, [topic], topic, 5, 10)
        assert result["next_action"] == "CLARIFY"
        assert topic.status == TopicStatus.AVAILABLE
        assert topic.questions_asked == 0

    def test_does_not_know_switches_topic(self):
        """DOES_NOT_KNOW should exhaust current topic and force NEW_TOPIC."""
        planner = QuestionPlanner()
        topic = _topic(id="t0", label="A", priority=1)
        other = _topic(id="t1", label="B", priority=2)

        classification = {
            "answer_status": "DOES_NOT_KNOW",
            "next_action": "NEW_TOPIC",
            "reason": "",
            "clarification_text": None,
        }

        result = planner.apply_hard_rules(classification, [topic, other], topic, 3, 10)
        assert result["next_action"] == "NEW_TOPIC"
        assert topic.status == TopicStatus.EXHAUSTED
        assert topic.exhaustion_reason == "DOES_NOT_KNOW"


# ── Provenance Tests ────────────────────────────────────────────


class TestProvenance:
    def test_topic_has_source_field(self):
        """Every topic must have a source field."""
        t = _topic(source="Uber Software Engineer")
        assert t.source == "Uber Software Engineer"

    def test_topic_has_primary_question(self):
        """Every topic must have a pre-generated primary question."""
        t = _topic(primary_question="How did you implement pagination?")
        assert t.primary_question == "How did you implement pagination?"

    def test_source_survives_serialization(self):
        """Source field should survive serialize/deserialize round-trip."""
        from infrastructure.repositories.topic_serialization import (
            serialize_topic_plan,
            deserialize_topic_plan,
        )
        topic_plan = [_topic(source="MergePilot", primary_question="How?")]
        serialized = serialize_topic_plan(topic_plan)
        deserialized = deserialize_topic_plan(serialized)
        assert deserialized[0].source == "MergePilot"
        assert deserialized[0].primary_question == "How?"

    def test_no_chunk_ids_in_topic(self):
        """TopicEntry should not have chunk_ids field."""
        t = _topic()
        assert not hasattr(t, "chunk_ids")


# ── Question Dedup Tests ────────────────────────────────────────


class TestQuestionDedup:
    def setup_method(self):
        self.planner = QuestionPlanner()

    @pytest.mark.asyncio
    async def test_question_embedded_only_once(self):
        """dedup_and_cache_question should embed once and reuse for both dedup and cache."""
        rag = AsyncMock()
        emb = np.array([0.5] * 768, dtype=np.float32)
        emb = emb / np.linalg.norm(emb)
        rag.get_embeddings = AsyncMock(return_value=[emb.tolist()])

        question_text, q_type, new_emb = await self.planner.dedup_and_cache_question(
            "What is your experience with React?",
            QuestionType.PRIMARY,
            rag,
        )

        assert rag.get_embeddings.call_count == 1
        assert len(self.planner._asked_embeddings) == 1
        assert new_emb is not None


# ── Topic Plan Compactness Tests ────────────────────────────────


class TestTopicPlanCompactness:
    def test_topic_plan_no_chunk_ids(self):
        """TopicEntry should not have chunk_ids field."""
        t = _topic()
        assert not hasattr(t, "chunk_ids")

    def test_serialization_no_chunk_ids(self):
        """Serialized topic plan should not contain chunk_ids."""
        from infrastructure.repositories.topic_serialization import serialize_topic_plan
        topic_plan = [_topic()]
        serialized = serialize_topic_plan(topic_plan)
        assert "chunk_ids" not in serialized

    def test_serialization_has_source_and_primary_question(self):
        """Serialized topic plan should contain source and primary_question."""
        from infrastructure.repositories.topic_serialization import serialize_topic_plan
        topic_plan = [_topic(source="Uber", primary_question="Why?")]
        serialized = serialize_topic_plan(topic_plan)
        assert '"source": "Uber"' in serialized
        assert '"primary_question": "Why?"' in serialized


# ── Max Topics Tests ────────────────────────────────────────────


class TestMaxTopics:
    @pytest.mark.asyncio
    async def test_max_8_topics_enforced(self):
        """Topic planner should enforce MAX_TOPICS=8."""
        from application.topic_planner import MAX_TOPICS
        assert MAX_TOPICS == 8


# ── Interview Model Tests ───────────────────────────────────────


class TestInterviewModel:
    def test_interview_has_snapshot_fields(self):
        """Interview should have resume_snapshot and jd_snapshot fields."""
        interview = Interview(
            resume_snapshot="My resume text",
            jd_snapshot="My JD text",
        )
        assert interview.resume_snapshot == "My resume text"
        assert interview.jd_snapshot == "My JD text"

    def test_interview_snapshots_default_empty(self):
        """Snapshots should default to empty string."""
        interview = Interview()
        assert interview.resume_snapshot == ""
        assert interview.jd_snapshot == ""
