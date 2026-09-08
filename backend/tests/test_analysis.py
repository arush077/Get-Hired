import json
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock
from domain.interview import Interview
from domain.question import Question, QuestionType
from domain.answer import Answer, AnswerStatus
from domain.topic import TopicEntry, TopicStatus
from api.contracts import AnalysisResult, QuestionFeedback, JdMatch


def _make_interview(num_questions=3):
    """Create a test interview with questions and answers."""
    questions = []
    answers = {}
    for i in range(num_questions):
        q = Question(
            text=f"Question {i + 1}?",
            question_type=QuestionType.PRIMARY if i > 0 else QuestionType.HR,
            order=i,
        )
        questions.append(q)
        answers[i] = Answer(
            question_id=q.id,
            transcript=f"Answer {i + 1}",
            answer_status=AnswerStatus.ANSWERED,
        )

    topic_plan = [
        TopicEntry(
            id="topic_0",
            label="Project A",
            source="Uber",
            primary_question="Tell me about Project A",
            priority=1,
            status=TopicStatus.ACTIVE,
            questions_asked=num_questions,
        ),
    ]

    return Interview(
        id=None,
        candidate_name="Test",
        job_role="SDE-1",
        resume_snapshot="Resume text",
        jd_snapshot="JD text",
        questions=questions,
        answers=answers,
        total_questions=num_questions,
        topic_plan=topic_plan,
        current_topic_id="topic_0",
    )


def _mock_analysis_response(**overrides):
    """Build a valid analysis response dict with defaults."""
    data = {
        "overall_score": 72,
        "dimensions": {"technical_depth": 78, "clarity": 65},
        "strengths": ["Strong debugging skills"],
        "areas_to_improve": ["More depth in architecture"],
        "recurring_patterns": ["Tends to describe what, not why"],
        "question_feedback": [
            {
                "question_number": 1,
                "score": 80,
                "what_went_well": "Clear answer",
                "what_was_missing": "Trade-offs",
                "how_to_improve": "Discuss alternatives",
            }
        ],
        "recommendations": ["Practice explaining design decisions"],
        "jd_match": {"strengths": ["API knowledge"], "gaps": ["Database depth"]},
    }
    data.update(overrides)
    return data


def _make_llm_instance(chat_return):
    """Create an LLMService instance via __new__ with mocked _chat and bound _parse_json."""
    from application.llm_service import LLMService

    llm = LLMService.__new__(LLMService)
    llm._client = AsyncMock()
    llm._chat = AsyncMock(return_value=chat_return)
    llm._parse_json = LLMService._parse_json.__get__(llm, LLMService)
    return llm


# ── Schema Validation Tests ─────────────────────────────────────


class TestAnalysisSchema:
    def test_analysis_result_has_all_fields(self):
        data = {
            "overall_score": 72,
            "dimensions": {"technical_depth": 78},
            "strengths": ["Strong debugging"],
            "areas_to_improve": ["More depth"],
            "recurring_patterns": ["Pattern 1"],
            "question_feedback": [
                {
                    "question_number": 1,
                    "score": 80,
                    "what_went_well": "Good",
                    "what_was_missing": "Missing",
                    "how_to_improve": "Improve",
                }
            ],
            "recommendations": ["Practice X"],
            "jd_match": {"strengths": ["API knowledge"], "gaps": ["Database"]},
        }
        result = AnalysisResult(**data)
        assert result.overall_score == 72
        assert result.dimensions == {"technical_depth": 78}
        assert len(result.question_feedback) == 1
        assert result.jd_match is not None

    def test_analysis_result_backward_compat(self):
        """Old format (no dimensions, no question_feedback) should still work."""
        old_data = {
            "overall_score": 65,
            "strengths": ["Good"],
            "areas_to_improve": ["Improve"],
        }
        result = AnalysisResult(**old_data)
        assert result.overall_score == 65
        assert result.dimensions == {}
        assert result.question_feedback == []
        assert result.recurring_patterns == []
        assert result.recommendations == []
        assert result.jd_match is None

    def test_dimension_scores_coerced_to_int(self):
        """Float dimension scores should be coerced to ints."""
        data = {
            "overall_score": 70,
            "dimensions": {"technical_depth": 78.5, "clarity": 62.1},
            "strengths": [],
            "areas_to_improve": [],
        }
        result = AnalysisResult(**data)
        assert isinstance(result.dimensions["technical_depth"], int)
        assert isinstance(result.dimensions["clarity"], int)

    def test_question_feedback_score_range(self):
        fb = QuestionFeedback(
            question_number=1,
            score=85,
            what_went_well="Good",
            what_was_missing="Missing",
            how_to_improve="Practice",
        )
        assert fb.score == 85

    def test_jd_match_optional(self):
        result = AnalysisResult(
            overall_score=70,
            strengths=[],
            areas_to_improve=[],
            jd_match=None,
        )
        assert result.jd_match is None

    def test_jd_match_has_strengths_and_gaps(self):
        jm = JdMatch(strengths=["API"], gaps=["DB"])
        assert jm.strengths == ["API"]
        assert jm.gaps == ["DB"]


# ── QuestionResult Tests ────────────────────────────────────────


class TestQuestionResult:
    def test_question_result_has_metadata(self):
        from api.contracts import QuestionResult

        qr = QuestionResult(
            question_index=0,
            question="Q1?",
            answer="A1",
            question_type="PRIMARY",
            topic_label="Project A",
            topic_source="Uber",
            answer_status="ANSWERED",
        )
        assert qr.question_type == "PRIMARY"
        assert qr.topic_label == "Project A"
        assert qr.topic_source == "Uber"
        assert qr.answer_status == "ANSWERED"

    def test_question_result_metadata_optional(self):
        from api.contracts import QuestionResult

        qr = QuestionResult(question_index=0, question="Q1?", answer="A1")
        assert qr.question_type is None
        assert qr.topic_label is None
        assert qr.topic_source is None
        assert qr.answer_status is None


# ── AnalysisService Tests ───────────────────────────────────────


class TestAnalysisService:
    @pytest.mark.asyncio
    async def test_analyze_builds_rich_context(self):
        from application.analysis_service import AnalysisService

        mock_llm = MagicMock()
        response = _mock_analysis_response()
        mock_llm.generate_analysis = AsyncMock(return_value=response)

        interview = _make_interview(3)
        service = AnalysisService(llm=mock_llm)
        result = await service.analyze(interview)

        mock_llm.generate_analysis.assert_called_once()
        ctx = mock_llm.generate_analysis.call_args[0][0]
        assert ctx["resume_text"] == "Resume text"
        assert ctx["jd_text"] == "JD text"
        assert ctx["job_role"] == "SDE-1"
        assert len(ctx["questions"]) == 3
        assert len(ctx["answers"]) == 3

    @pytest.mark.asyncio
    async def test_analyze_includes_question_metadata(self):
        from application.analysis_service import AnalysisService

        mock_llm = MagicMock()
        mock_llm.generate_analysis = AsyncMock(return_value=_mock_analysis_response())

        interview = _make_interview(2)
        service = AnalysisService(llm=mock_llm)
        await service.analyze(interview)

        ctx = mock_llm.generate_analysis.call_args[0][0]
        q0 = ctx["questions"][0]
        assert q0["type"] == "HR"
        assert q0["topic_label"] == "Project A"
        assert q0["topic_source"] == "Uber"

    @pytest.mark.asyncio
    async def test_analyze_no_answers_returns_zero(self):
        from application.analysis_service import AnalysisService

        mock_llm = MagicMock()
        mock_llm.generate_analysis = AsyncMock()
        interview = _make_interview(0)
        interview.answers = {}

        service = AnalysisService(llm=mock_llm)
        result = await service.analyze(interview)

        assert result["overall_score"] == 0
        assert result["question_feedback"] == []
        mock_llm.generate_analysis.assert_not_called()

    @pytest.mark.asyncio
    async def test_analyze_includes_answer_status(self):
        from application.analysis_service import AnalysisService

        mock_llm = MagicMock()
        mock_llm.generate_analysis = AsyncMock(return_value=_mock_analysis_response())

        interview = _make_interview(1)
        service = AnalysisService(llm=mock_llm)
        await service.analyze(interview)

        ctx = mock_llm.generate_analysis.call_args[0][0]
        assert ctx["answers"][0]["answer_status"] == "ANSWERED"


# ── LLM Prompt Integration Tests ───────────────────────────────


class TestLLMGenerateAnalysis:
    @pytest.mark.asyncio
    async def test_generate_analysis_clamps_scores(self):
        from application.llm_service import LLMService

        raw_response = {
            "overall_score": 150,
            "dimensions": {"technical_depth": -5, "clarity": 200},
            "strengths": [],
            "areas_to_improve": [],
        }
        llm = _make_llm_instance(json.dumps(raw_response))

        result = await llm.generate_analysis({
            "resume_text": "Resume",
            "jd_text": "JD",
            "job_role": "SDE",
            "questions": [],
            "answers": [],
        })

        assert result["overall_score"] == 100
        assert result["dimensions"]["technical_depth"] == 0
        assert result["dimensions"]["clarity"] == 100

    @pytest.mark.asyncio
    async def test_generate_analysis_handles_parse_failure(self):
        llm = _make_llm_instance("not json at all")

        result = await llm.generate_analysis({
            "resume_text": "Resume",
            "jd_text": "JD",
            "job_role": "SDE",
            "questions": [],
            "answers": [],
        })

        assert result["overall_score"] == 0
        assert result["strengths"] == []
        assert "failed" in result["areas_to_improve"][0].lower()

    @pytest.mark.asyncio
    async def test_generate_analysis_ensures_required_fields(self):
        raw_response = {"overall_score": 72}
        llm = _make_llm_instance(json.dumps(raw_response))

        result = await llm.generate_analysis({
            "resume_text": "Resume",
            "jd_text": "JD",
            "job_role": "SDE",
            "questions": [],
            "answers": [],
        })

        assert "dimensions" in result
        assert "strengths" in result
        assert "areas_to_improve" in result
        assert "recurring_patterns" in result
        assert "question_feedback" in result
        assert "recommendations" in result
        assert "jd_match" in result

    @pytest.mark.asyncio
    async def test_generate_analysis_clamps_per_question_scores(self):
        raw_response = {
            "overall_score": 70,
            "question_feedback": [
                {"question_number": 1, "score": 200, "what_went_well": "x", "what_was_missing": "y", "how_to_improve": "z"},
                {"question_number": 2, "score": -10, "what_went_well": "x", "what_was_missing": "y", "how_to_improve": "z"},
            ],
        }
        llm = _make_llm_instance(json.dumps(raw_response))

        result = await llm.generate_analysis({
            "resume_text": "Resume",
            "jd_text": "JD",
            "job_role": "SDE",
            "questions": [],
            "answers": [],
        })

        assert result["question_feedback"][0]["score"] == 100
        assert result["question_feedback"][1]["score"] == 0

    @pytest.mark.asyncio
    async def test_no_additional_live_llm_calls(self):
        """Confirm that generate_analysis is only called once (post-interview)."""
        from application.analysis_service import AnalysisService

        mock_llm = MagicMock()
        mock_llm.generate_analysis = AsyncMock(return_value=_mock_analysis_response())

        interview = _make_interview(3)
        service = AnalysisService(llm=mock_llm)
        await service.analyze(interview)

        # Only ONE call to generate_analysis
        assert mock_llm.generate_analysis.call_count == 1


# ── Interview Domain Tests ──────────────────────────────────────


class TestInterviewDomain:
    def test_interview_has_snapshots(self):
        interview = _make_interview()
        assert interview.resume_snapshot == "Resume text"
        assert interview.jd_snapshot == "JD text"

    def test_topic_has_source(self):
        topic = TopicEntry(
            id="t0", label="A", source="Uber",
            primary_question="Q?", priority=1,
        )
        assert topic.source == "Uber"

    def test_answer_has_status(self):
        answer = Answer(transcript="test", answer_status=AnswerStatus.PARTIAL_ANSWER)
        assert answer.answer_status == AnswerStatus.PARTIAL_ANSWER

    def test_question_has_type(self):
        q = Question(text="Q?", question_type=QuestionType.FOLLOW_UP, order=0)
        assert q.question_type == QuestionType.FOLLOW_UP


# ── Topic Map Tests ────────────────────────────────────────────


class TestTopicMap:
    def test_build_topic_map_basic(self):
        from application.interview_service import InterviewService

        mock_repo = MagicMock()
        mock_llm = MagicMock()
        mock_embedding = MagicMock()
        mock_planner = MagicMock()
        service = InterviewService(mock_repo, mock_llm, mock_embedding, mock_planner)

        interview = _make_interview(3)
        topic_map = service._build_topic_map(interview)

        assert topic_map[0] == ("Project A", "Uber")
        assert topic_map[1] == ("Project A", "Uber")
        assert topic_map[2] == ("Project A", "Uber")

    def test_build_topic_map_empty_plan(self):
        from application.interview_service import InterviewService

        mock_repo = MagicMock()
        mock_llm = MagicMock()
        mock_embedding = MagicMock()
        mock_planner = MagicMock()
        service = InterviewService(mock_repo, mock_llm, mock_embedding, mock_planner)

        interview = _make_interview(2)
        interview.topic_plan = []
        topic_map = service._build_topic_map(interview)

        assert topic_map == {}

    def test_build_topic_map_multiple_topics(self):
        from application.interview_service import InterviewService

        mock_repo = MagicMock()
        mock_llm = MagicMock()
        mock_embedding = MagicMock()
        mock_planner = MagicMock()
        service = InterviewService(mock_repo, mock_llm, mock_embedding, mock_planner)

        interview = _make_interview(4)
        interview.topic_plan = [
            TopicEntry(
                id="t0", label="Topic A", source="Uber",
                primary_question="Q1?", priority=1,
                status=TopicStatus.EXHAUSTED, questions_asked=2,
            ),
            TopicEntry(
                id="t1", label="Topic B", source="MergePilot",
                primary_question="Q3?", priority=2,
                status=TopicStatus.ACTIVE, questions_asked=2,
            ),
        ]
        topic_map = service._build_topic_map(interview)

        assert topic_map[0] == ("Topic A", "Uber")
        assert topic_map[1] == ("Topic A", "Uber")
        assert topic_map[2] == ("Topic B", "MergePilot")
        assert topic_map[3] == ("Topic B", "MergePilot")


class TestAnalysisReliability:
    """Tests for background analysis retries and on-demand fallback."""

    def _make_completed_interview(self, analysis=None, analysis_status="PENDING"):
        from domain.analysis_status import AnalysisStatus
        from domain.interview_state import InterviewState
        interview = _make_interview(3)
        interview.status = InterviewState.COMPLETED
        interview.analysis = analysis
        interview.analysis_status = AnalysisStatus(analysis_status)
        return interview

    @pytest.mark.asyncio
    async def test_background_analysis_succeeds(self):
        from application.interview_service import InterviewService
        from domain.analysis_status import AnalysisStatus

        interview = self._make_completed_interview()
        analysis_result = _mock_analysis_response()

        mock_repo = AsyncMock()
        mock_repo.get = AsyncMock(return_value=interview)
        mock_repo.save = AsyncMock()

        mock_llm = MagicMock()
        mock_llm.generate_analysis = AsyncMock(return_value=analysis_result)

        mock_embedding = MagicMock()
        mock_planner = MagicMock()
        service = InterviewService(mock_repo, mock_llm, mock_embedding, mock_planner)

        await service._run_analysis(interview.id)

        assert interview.analysis == analysis_result
        assert interview.analysis_status == AnalysisStatus.COMPLETED
        assert mock_repo.save.call_count >= 2

    @pytest.mark.asyncio
    async def test_background_analysis_retries_on_failure(self):
        from application.interview_service import InterviewService
        from domain.analysis_status import AnalysisStatus

        interview = self._make_completed_interview()
        analysis_result = _mock_analysis_response()

        mock_repo = AsyncMock()
        mock_repo.get = AsyncMock(return_value=interview)
        mock_repo.save = AsyncMock()

        mock_llm = MagicMock()
        call_count = 0
        async def flaky_generate(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise Exception("Transient GROQ error")
            return analysis_result
        mock_llm.generate_analysis = flaky_generate

        mock_embedding = MagicMock()
        mock_planner = MagicMock()
        service = InterviewService(mock_repo, mock_llm, mock_embedding, mock_planner)

        await service._run_analysis(interview.id)

        assert interview.analysis == analysis_result
        assert interview.analysis_status == AnalysisStatus.COMPLETED
        assert call_count == 2

    @pytest.mark.asyncio
    async def test_background_analysis_all_retries_fail(self):
        from application.interview_service import InterviewService
        from domain.analysis_status import AnalysisStatus

        interview = self._make_completed_interview()

        mock_repo = AsyncMock()
        mock_repo.get = AsyncMock(return_value=interview)
        mock_repo.save = AsyncMock()

        mock_llm = MagicMock()
        mock_llm.generate_analysis = AsyncMock(side_effect=Exception("GROQ down"))

        mock_embedding = MagicMock()
        mock_planner = MagicMock()
        service = InterviewService(mock_repo, mock_llm, mock_embedding, mock_planner)

        await service._run_analysis(interview.id)

        assert interview.analysis is None
        assert interview.analysis_status == AnalysisStatus.FAILED

    @pytest.mark.asyncio
    async def test_get_results_generates_analysis_on_demand(self):
        from application.interview_service import InterviewService
        from domain.analysis_status import AnalysisStatus

        interview = self._make_completed_interview()
        analysis_result = _mock_analysis_response()

        call_count = 0
        async def mock_get(interview_id):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return interview
            return interview

        mock_repo = AsyncMock()
        mock_repo.get = mock_get
        mock_repo.save = AsyncMock()

        mock_llm = MagicMock()
        mock_llm.generate_analysis = AsyncMock(return_value=analysis_result)

        mock_embedding = MagicMock()
        mock_planner = MagicMock()
        service = InterviewService(mock_repo, mock_llm, mock_embedding, mock_planner)

        results = await service.get_results(interview.id)

        assert results["analysis"] == analysis_result
        assert interview.analysis_status == AnalysisStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_get_results_returns_existing_analysis(self):
        from application.interview_service import InterviewService

        existing_analysis = _mock_analysis_response()
        interview = self._make_completed_interview(analysis=existing_analysis, analysis_status="COMPLETED")

        mock_repo = AsyncMock()
        mock_repo.get = AsyncMock(return_value=interview)
        mock_repo.save = AsyncMock()

        mock_llm = MagicMock()
        mock_llm.generate_analysis = AsyncMock()

        mock_embedding = MagicMock()
        mock_planner = MagicMock()
        service = InterviewService(mock_repo, mock_llm, mock_embedding, mock_planner)

        results = await service.get_results(interview.id)

        assert results["analysis"] == existing_analysis
        mock_llm.generate_analysis.assert_not_called()

    @pytest.mark.asyncio
    async def test_non_completed_interview_no_analysis_trigger(self):
        from application.interview_service import InterviewService
        from domain.interview_state import InterviewState

        interview = _make_interview(3)
        interview.status = InterviewState.WAITING_FOR_ANSWER
        interview.analysis = None

        mock_repo = AsyncMock()
        mock_repo.get = AsyncMock(return_value=interview)
        mock_repo.save = AsyncMock()

        mock_llm = MagicMock()
        mock_llm.generate_analysis = AsyncMock()

        mock_embedding = MagicMock()
        mock_planner = MagicMock()
        service = InterviewService(mock_repo, mock_llm, mock_embedding, mock_planner)

        results = await service.get_results(interview.id)

        assert results["analysis"] is None
        mock_llm.generate_analysis.assert_not_called()

    @pytest.mark.asyncio
    async def test_concurrent_get_results_no_duplicate_analysis(self):
        from application.interview_service import InterviewService
        from domain.analysis_status import AnalysisStatus
        import copy
        import asyncio

        analysis_result = _mock_analysis_response()

        mock_repo = AsyncMock()
        call_count = 0

        async def mock_get(interview_id):
            nonlocal call_count
            call_count += 1
            interview = self._make_completed_interview()
            return interview

        mock_repo.get = mock_get
        mock_repo.save = AsyncMock()

        mock_llm = MagicMock()
        generate_call_count = 0

        async def slow_generate(*args, **kwargs):
            nonlocal generate_call_count
            generate_call_count += 1
            await asyncio.sleep(0.05)
            return analysis_result

        mock_llm.generate_analysis = slow_generate

        mock_embedding = MagicMock()
        mock_planner = MagicMock()
        service = InterviewService(mock_repo, mock_llm, mock_embedding, mock_planner)

        results1, results2 = await asyncio.gather(
            service.get_results(uuid.uuid4()),
            service.get_results(uuid.uuid4()),
        )

        assert generate_call_count == 2
        assert results1["analysis"] == analysis_result
        assert results2["analysis"] == analysis_result
