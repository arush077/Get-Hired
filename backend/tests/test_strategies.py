import json
import pytest
from unittest.mock import AsyncMock, MagicMock
from domain.interview_mode import InterviewMode
from domain.interview import Interview
from domain.question import Question, QuestionType
from domain.answer import Answer, AnswerStatus
from domain.topic import TopicEntry, TopicStatus
from application.strategies.base import InterviewStrategy
from application.strategies.factory import InterviewStrategyFactory
from application.strategies.resume_deep_dive import ResumeDeepDiveStrategy
from application.strategies.technical import TechnicalStrategy
from application.strategies.hr_screening import HRScreeningStrategy
from application.strategies.mixed import MixedInterviewStrategy


# ── Strategy Interface Tests ──────────────────────────────────────


class TestStrategyInterface:
    def test_all_strategies_implement_interface(self):
        strategies = [
            ResumeDeepDiveStrategy(),
            TechnicalStrategy(),
            HRScreeningStrategy(),
            MixedInterviewStrategy(),
        ]
        for s in strategies:
            assert isinstance(s, InterviewStrategy)
            assert callable(s.get_initial_planning_instructions)
            assert callable(s.get_runtime_instructions)
            assert callable(s.get_evaluation_instructions)

    def test_initial_planning_returns_nonempty_string(self):
        strategies = [
            ResumeDeepDiveStrategy(),
            TechnicalStrategy(),
            HRScreeningStrategy(),
            MixedInterviewStrategy(),
        ]
        for s in strategies:
            result = s.get_initial_planning_instructions()
            assert isinstance(result, str)
            assert len(result) > 50

    def test_runtime_returns_nonempty_string(self):
        strategies = [
            ResumeDeepDiveStrategy(),
            TechnicalStrategy(),
            HRScreeningStrategy(),
            MixedInterviewStrategy(),
        ]
        for s in strategies:
            result = s.get_runtime_instructions()
            assert isinstance(result, str)
            assert len(result) > 50

    def test_evaluation_returns_nonempty_string(self):
        strategies = [
            ResumeDeepDiveStrategy(),
            TechnicalStrategy(),
            HRScreeningStrategy(),
            MixedInterviewStrategy(),
        ]
        for s in strategies:
            result = s.get_evaluation_instructions()
            assert isinstance(result, str)
            assert len(result) > 50


# ── Factory Tests ─────────────────────────────────────────────────


class TestInterviewStrategyFactory:
    def test_resume_deep_dive_maps_correctly(self):
        strategy = InterviewStrategyFactory.get(InterviewMode.RESUME_DEEP_DIVE)
        assert isinstance(strategy, ResumeDeepDiveStrategy)

    def test_technical_maps_correctly(self):
        strategy = InterviewStrategyFactory.get(InterviewMode.TECHNICAL)
        assert isinstance(strategy, TechnicalStrategy)

    def test_hr_screening_maps_correctly(self):
        strategy = InterviewStrategyFactory.get(InterviewMode.HR_SCREENING)
        assert isinstance(strategy, HRScreeningStrategy)

    def test_mixed_maps_correctly(self):
        strategy = InterviewStrategyFactory.get(InterviewMode.MIXED)
        assert isinstance(strategy, MixedInterviewStrategy)

    def test_invalid_mode_raises(self):
        with pytest.raises(ValueError, match="Unsupported interview mode"):
            InterviewStrategyFactory.get("INVALID_MODE")

    def test_factory_returns_new_instances(self):
        s1 = InterviewStrategyFactory.get(InterviewMode.MIXED)
        s2 = InterviewStrategyFactory.get(InterviewMode.MIXED)
        assert s1 is not s2


# ── Mode-Specific Content Tests ───────────────────────────────────


class TestResumeDeepDiveStrategy:
    def test_initial_mentions_resume_projects(self):
        s = ResumeDeepDiveStrategy()
        text = s.get_initial_planning_instructions()
        assert "Resume Deep Dive" in text
        assert "projects" in text.lower() or "experience" in text.lower()

    def test_runtime_mentions_implementation(self):
        s = ResumeDeepDiveStrategy()
        text = s.get_runtime_instructions()
        assert "implementation" in text.lower() or "ownership" in text.lower()

    def test_evaluation_mentions_technical_depth(self):
        s = ResumeDeepDiveStrategy()
        text = s.get_evaluation_instructions()
        assert "technical_depth" in text.lower() or "technical" in text.lower()


class TestTechnicalStrategy:
    def test_initial_mentions_technical(self):
        s = TechnicalStrategy()
        text = s.get_initial_planning_instructions()
        assert "Technical" in text
        assert "skills" in text.lower() or "system design" in text.lower() or "trade-offs" in text.lower()

    def test_runtime_mentions_implementation(self):
        s = TechnicalStrategy()
        text = s.get_runtime_instructions()
        assert "implementation" in text.lower() or "trade-offs" in text.lower()

    def test_evaluation_mentions_technical_depth(self):
        s = TechnicalStrategy()
        text = s.get_evaluation_instructions()
        assert "technical_depth" in text.lower() or "correctness" in text.lower()


class TestHRScreeningStrategy:
    def test_initial_mentions_hr_screening(self):
        s = HRScreeningStrategy()
        text = s.get_initial_planning_instructions()
        assert "HR Screening" in text
        assert "motivation" in text.lower() or "career" in text.lower()

    def test_runtime_mentions_conversational(self):
        s = HRScreeningStrategy()
        text = s.get_runtime_instructions()
        assert "conversational" in text.lower() or "motivation" in text.lower()

    def test_evaluation_does_not_require_technical(self):
        s = HRScreeningStrategy()
        text = s.get_evaluation_instructions()
        assert "not penalize" in text.lower() or "technical" in text.lower()


class TestMixedInterviewStrategy:
    def test_initial_mentions_mixed(self):
        s = MixedInterviewStrategy()
        text = s.get_initial_planning_instructions()
        assert "Mixed" in text
        assert "technical" in text.lower() or "resume" in text.lower()

    def test_runtime_respects_question_category(self):
        s = MixedInterviewStrategy()
        text = s.get_runtime_instructions()
        assert "category" in text.lower() or "balance" in text.lower()

    def test_evaluation_balances_dimensions(self):
        s = MixedInterviewStrategy()
        text = s.get_evaluation_instructions()
        assert "balance" in text.lower() or "technical" in text.lower()


# ── InterviewMode Enum Tests ──────────────────────────────────────


class TestInterviewMode:
    def test_all_modes_exist(self):
        modes = [
            InterviewMode.RESUME_DEEP_DIVE,
            InterviewMode.TECHNICAL,
            InterviewMode.HR_SCREENING,
            InterviewMode.MIXED,
        ]
        assert len(modes) == 4

    def test_mode_values(self):
        assert InterviewMode.RESUME_DEEP_DIVE.value == "RESUME_DEEP_DIVE"
        assert InterviewMode.TECHNICAL.value == "TECHNICAL"
        assert InterviewMode.HR_SCREENING.value == "HR_SCREENING"
        assert InterviewMode.MIXED.value == "MIXED"

    def test_mode_is_string_enum(self):
        assert isinstance(InterviewMode.MIXED, str)
        assert InterviewMode.MIXED == "MIXED"


# ── Domain Integration Tests ──────────────────────────────────────


class TestInterviewWithMode:
    def test_interview_has_mode_field(self):
        interview = Interview(interview_mode=InterviewMode.TECHNICAL)
        assert interview.interview_mode == InterviewMode.TECHNICAL

    def test_interview_defaults_to_mixed(self):
        interview = Interview()
        assert interview.interview_mode == InterviewMode.MIXED

    def test_interview_mode_persists(self):
        for mode in InterviewMode:
            interview = Interview(interview_mode=mode)
            assert interview.interview_mode == mode


# ── Topic Planner Integration Tests ───────────────────────────────


class TestTopicPlannerStrategyIntegration:
    @pytest.mark.asyncio
    async def test_strategy_instructions_injected_into_prompt(self):
        from application.topic_planner import _extract_topics

        mock_llm = AsyncMock()
        mock_llm._chat = AsyncMock(return_value=json.dumps({
            "topics": [{
                "id": "test_topic",
                "label": "Test Topic",
                "source": "Test Source",
                "priority": 8,
                "primary_question": "Test question?",
            }]
        }))
        mock_llm._parse_json = MagicMock(side_effect=lambda x: json.loads(x))

        strategy = TechnicalStrategy()
        await _extract_topics(
            resume_text="Resume",
            jd_text="JD",
            job_role="SDE",
            llm=mock_llm,
            count=4,
            strategy=strategy,
        )

        call_args = mock_llm._chat.call_args
        messages = call_args[0][0]
        system_content = messages[0]["content"]
        assert "Technical" in system_content

    @pytest.mark.asyncio
    async def test_no_strategy_works(self):
        from application.topic_planner import _extract_topics

        mock_llm = AsyncMock()
        mock_llm._chat = AsyncMock(return_value=json.dumps({
            "topics": [{
                "id": "test_topic",
                "label": "Test Topic",
                "source": "Test Source",
                "priority": 8,
                "primary_question": "Test question?",
            }]
        }))
        mock_llm._parse_json = MagicMock(side_effect=lambda x: json.loads(x))

        result = await _extract_topics(
            resume_text="Resume",
            jd_text="JD",
            job_role="SDE",
            llm=mock_llm,
            count=4,
            strategy=None,
        )
        assert len(result) == 1


# ── LLM Service Integration Tests ─────────────────────────────────


class TestLLMStrategyIntegration:
    @pytest.mark.asyncio
    async def test_classify_and_decide_injects_strategy(self):
        from application.llm_service import LLMService

        llm = LLMService.__new__(LLMService)
        llm._client = AsyncMock()
        llm._client.chat.completions.create = AsyncMock(return_value=MagicMock(
            choices=[MagicMock(message=MagicMock(content=json.dumps({
                "answer_status": "ANSWERED",
                "next_action": "FOLLOW_UP",
                "next_topic_id": None,
                "reason": "good answer",
                "question": "Can you elaborate on that?",
                "clarification_text": None,
            })))]
        ))

        strategy = ResumeDeepDiveStrategy()
        result = await llm.classify_and_decide(
            resume_text="Resume",
            jd_text="JD",
            job_role="SDE",
            current_topic_label="Test",
            current_topic_source="TestSource",
            current_question="Test question?",
            candidate_answer="Test answer",
            questions_on_topic=1,
            topics_remaining=["Topic B"],
            interview_history=[],
            previously_asked_questions=[],
            strategy=strategy,
        )

        call_args = llm._client.chat.completions.create.call_args
        messages = call_args[1]["messages"]
        system_content = messages[0]["content"]
        assert "Resume Deep Dive" in system_content

    @pytest.mark.asyncio
    async def test_generate_analysis_injects_strategy(self):
        from application.llm_service import LLMService

        llm = LLMService.__new__(LLMService)
        llm._client = AsyncMock()
        llm._client.chat.completions.create = AsyncMock(return_value=MagicMock(
            choices=[MagicMock(message=MagicMock(content=json.dumps({
                "overall_score": 75,
                "dimensions": {"technical_depth": 80, "correctness": 70, "specificity": 75, "clarity": 70, "communication": 75},
                "strengths": ["Good examples"],
                "areas_to_improve": ["More detail"],
                "recurring_patterns": [],
                "question_feedback": [],
                "recommendations": ["Practice more"],
                "jd_match": {"strengths": ["Python"], "gaps": ["Go"]},
            })))]
        ))

        strategy = TechnicalStrategy()
        context = {
            "resume_text": "Resume",
            "jd_text": "JD",
            "job_role": "SDE",
            "questions": [{"index": 0, "text": "Q1", "type": "PRIMARY", "topic_label": "T1", "topic_source": "S1"}],
            "answers": [{"index": 0, "transcript": "A1", "answer_status": "ANSWERED"}],
            "strategy": strategy,
        }

        result = await llm.generate_analysis(context)
        assert result["overall_score"] == 75

        call_args = llm._client.chat.completions.create.call_args
        messages = call_args[1]["messages"]
        system_content = messages[0]["content"]
        assert "Technical" in system_content
