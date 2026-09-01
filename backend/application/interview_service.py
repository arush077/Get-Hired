import logging
from uuid import UUID

from domain.interview import Interview
from domain.interview_mode import InterviewMode
from domain.question import Question, QuestionType
from domain.answer import Answer, AnswerStatus
from domain.interview_state import InterviewState
from domain.topic import TopicEntry, TopicStatus
from infrastructure.repositories.base import InterviewRepositoryInterface
from application.llm_service import LLMService
from application.embedding_service import EmbeddingService
from application.topic_planner import build_topic_plan
from application.question_planner import QuestionPlanner, PlannerContext, MAX_QUESTIONS_PER_TOPIC
from application.strategies.factory import InterviewStrategyFactory
from application.timing import Timer, StepTimer

logger = logging.getLogger(__name__)


class InterviewService:
    def __init__(
        self,
        repository: InterviewRepositoryInterface,
        llm_service: LLMService,
        embedding_service: EmbeddingService,
        planner: QuestionPlanner,
    ):
        self._repository = repository
        self._llm = llm_service
        self._embedding = embedding_service
        self._planner = planner

    async def start_interview(
        self,
        candidate_name: str,
        job_role: str,
        jd_text: str,
        total_questions: int = 10,
        interview_mode: InterviewMode = InterviewMode.MIXED,
        user_id: UUID | None = None,
        resume_id: str | None = None,
        resume_text: str | None = None,
    ) -> Interview:
        # Resolve resume text from saved resume or use provided text
        resolved_resume_id = None
        if resume_id:
            resolved_resume_id = UUID(resume_id)
            from api.dependencies import get_resume_service
            resume_service = get_resume_service()
            resume = await resume_service.get_resume(resolved_resume_id, user_id)
            if not resume:
                raise ValueError("Resume not found")
            resume_text = resume.to_text()

        if not resume_text:
            raise ValueError("Resume text is required")

        interview = Interview(
            user_id=user_id,
            candidate_name=candidate_name,
            job_role=job_role,
            interview_mode=interview_mode,
            total_questions=total_questions,
            resume_id=resolved_resume_id,
            resume_snapshot=resume_text,
            jd_snapshot=jd_text,
        )

        # Resolve strategy for this interview mode
        strategy = InterviewStrategyFactory.get(interview_mode)

        # ONE LLM call: build topic plan with primary questions
        async with Timer("build_topic_plan").measure() as t:
            topic_plan = await build_topic_plan(
                resume_text=resume_text,
                jd_text=jd_text,
                job_role=job_role,
                llm=self._llm,
                total_questions=total_questions,
                strategy=strategy,
            )
        logger.info("[INTERVIEW] Topic plan built in %.2fs: %d topics", t.elapsed, len(topic_plan))

        interview.topic_plan = topic_plan
        interview.current_topic_id = topic_plan[0].id if topic_plan else None

        self._planner.reset_embeddings()

        # Use first topic's pre-generated primary question
        first_topic = topic_plan[0] if topic_plan else None
        if first_topic:
            question_text = first_topic.primary_question
            q_type = QuestionType.PRIMARY
        else:
            question_text = await self._llm.generate_hr_question(candidate_name, job_role, "introductory")
            q_type = QuestionType.HR

        interview.questions.append(
            Question(text=question_text, question_type=q_type, order=0)
        )

        interview.status = interview.status.next()
        interview.status = interview.status.next()
        await self._repository.save(interview)
        return interview

    async def get_interview(self, interview_id: UUID) -> Interview | None:
        return await self._repository.get(interview_id)

    async def submit_answer(self, interview_id: UUID, transcript: str) -> dict | None:
        timer = StepTimer("submit_answer")

        async with Timer("load_interview").measure() as t:
            interview = await self._repository.get(interview_id)
        timer.step("load_interview", t.elapsed)

        if not interview:
            return None
        if not interview.status.can_accept_answer():
            return None

        answer = Answer(transcript=transcript)
        interview.submit_answer(answer)

        current_q = interview.questions[-1] if interview.questions else None
        current_topic = self._get_current_topic(interview)

        context = self._build_context(interview)

        # Resolve strategy for this interview mode
        strategy = InterviewStrategyFactory.get(interview.interview_mode)

        # ONE LLM call: classify + decide + generate follow-up
        async with Timer("classify_and_decide").measure() as t:
            result = await self._llm.classify_and_decide(
                resume_text=interview.resume_snapshot,
                jd_text=interview.jd_snapshot,
                job_role=interview.job_role,
                current_topic_label=current_topic.label if current_topic else "",
                current_topic_source=current_topic.source if current_topic else "",
                current_question=current_q.text if current_q else "",
                candidate_answer=transcript,
                questions_on_topic=current_topic.questions_asked if current_topic else 0,
                topics_remaining=[t.label for t in context.unvisited_topics],
                interview_history=context.previous_qa,
                previously_asked_questions=context.previous_questions,
                strategy=strategy,
            )
        timer.step("classify_and_decide", t.elapsed)

        # Python enforces hard rules
        enforced = self._planner.apply_hard_rules(
            classification=result,
            topic_plan=interview.topic_plan,
            current_topic=current_topic,
            questions_answered=interview.answered_count,
            total_questions=interview.total_questions,
        )

        answer.answer_status = AnswerStatus(enforced["answer_status"])
        logger.info(
            "[INTERVIEW] Answer classified: status=%s, action=%s, topic=%s",
            enforced["answer_status"], enforced["next_action"],
            current_topic.label if current_topic else "none",
        )

        # Handle clarification — don't consume a question slot, no question generation needed
        if enforced["next_action"] == "CLARIFY":
            interview.status = InterviewState.WAITING_FOR_ANSWER
            async with Timer("save_interview").measure() as t:
                await self._repository.save(interview)
            timer.step("save_interview", t.elapsed)
            timer.log_summary()
            return {
                "interview_id": str(interview.id),
                "question_index": interview.current_question_index,
                "answered_count": interview.answered_count,
                "status": interview.status.value,
                "next_question": enforced.get("clarification_text") or (current_q.text if current_q else ""),
                "next_question_index": interview.current_question_index,
                "total_questions": interview.total_questions,
                "is_clarification": True,
                "next_action": "CLARIFY",
                "analysis": None,
            }

        # Handle NEW_TOPIC
        if enforced["next_action"] == "NEW_TOPIC" and current_topic:
            if current_topic.status != TopicStatus.EXHAUSTED:
                current_topic.status = TopicStatus.EXHAUSTED
                current_topic.exhaustion_reason = (
                    "DOES_NOT_KNOW" if enforced["answer_status"] == "DOES_NOT_KNOW"
                    else "SUFFICIENTLY_EXPLORED"
                )

        # Increment questions_asked on current topic
        if current_topic:
            current_topic.questions_asked += 1

        # Generate next question if budget allows
        is_complete = False
        if interview.answered_count < interview.total_questions:
            if enforced["next_action"] == "NEW_TOPIC":
                # Use planner to select next topic (prefers LLM suggestion, falls back to priority)
                suggested_id = enforced.get("next_topic_id")
                next_topic = self._planner.select_topic(interview.topic_plan, suggested_id)
                if next_topic:
                    interview.current_topic_id = next_topic.id
                    question_text = next_topic.primary_question
                    q_type = QuestionType.PRIMARY
                else:
                    # No more topics — generate fallback question if budget remains
                    question_text = "Can you tell me more about your experience?"
                    q_type = QuestionType.PRIMARY
            elif enforced.get("question"):
                # FOLLOW_UP: question was generated in the unified call
                question_text = enforced["question"]
                q_type = QuestionType.FOLLOW_UP
            elif interview.answered_count < 2:
                # HR question: generate separately (no RAG needed)
                variant = "introductory" if interview.answered_count == 0 else "motivational"
                async with Timer("generate_hr_question").measure() as t:
                    question_text = await self._llm.generate_hr_question(
                        candidate_name=interview.candidate_name,
                        job_role=interview.job_role,
                        variant=variant,
                    )
                q_type = QuestionType.HR
                timer.step("generate_hr_question", t.elapsed)
            else:
                # Fallback
                question_text = "Can you tell me more about your experience?"
                q_type = QuestionType.PRIMARY

            if question_text:
                # Dedup + embed question
                async with Timer("dedup_and_embed").measure() as t:
                    question_text, q_type, question_emb = await self._planner.dedup_and_cache_question(
                        question_text, q_type, self._embedding.get_embeddings
                    )
                timer.step("dedup_and_embed", t.elapsed)

                new_index = len(interview.questions)
                interview.questions.append(
                    Question(text=question_text, question_type=q_type, order=new_index)
                )
                interview.advance()
        else:
            interview.status = InterviewState.COMPLETED
            is_complete = True

        async with Timer("save_interview").measure() as t:
            await self._repository.save(interview)
        timer.step("save_interview", t.elapsed)

        # Generate analysis after interview completes
        if interview.status == InterviewState.COMPLETED and interview.analysis is None:
            try:
                from application.analysis_service import AnalysisService
                analysis_service = AnalysisService(llm=self._llm)
                async with Timer("final_analysis").measure() as t:
                    interview.analysis = await analysis_service.analyze(interview)
                timer.step("final_analysis", t.elapsed)
                await self._repository.save(interview)
            except Exception as e:
                logger.error("[INTERVIEW] Analysis failed: %s", e)

        timer.log_summary()

        q = interview.questions[-1] if interview.questions else None
        return {
            "interview_id": str(interview.id),
            "question_index": interview.current_question_index if not is_complete else None,
            "answered_count": interview.answered_count,
            "status": interview.status.value,
            "next_question": None if is_complete else (q.text if q else None),
            "next_question_index": interview.current_question_index if not is_complete else None,
            "total_questions": interview.total_questions,
            "is_clarification": False,
            "next_action": enforced["next_action"] if not is_complete else None,
            "analysis": interview.analysis,
        }

    async def get_results(self, interview_id: UUID) -> dict | None:
        interview = await self._repository.get(interview_id)
        if not interview:
            return None

        topic_map = self._build_topic_map(interview)

        results = []
        for i, question in enumerate(interview.questions):
            answer = interview.answers.get(i)
            topic_label, topic_source = topic_map.get(i, ("", ""))
            results.append(
                {
                    "question_index": i,
                    "question": question.text,
                    "answer": answer.transcript if answer else "(no answer captured)",
                    "question_type": question.question_type.value,
                    "topic_label": topic_label,
                    "topic_source": topic_source,
                    "answer_status": answer.answer_status.value if answer and answer.answer_status else None,
                }
            )

        return {
            "interview_id": str(interview.id),
            "status": interview.status.value,
            "results": results,
            "analysis": interview.analysis,
        }

    def _build_topic_map(self, interview: Interview) -> dict[int, tuple[str, str]]:
        """Map question index -> (topic_label, topic_source)."""
        topic_map: dict[int, tuple[str, str]] = {}
        if not interview.topic_plan:
            return topic_map

        sorted_topics = sorted(interview.topic_plan, key=lambda t: t.priority)
        q_index = 0
        for topic in sorted_topics:
            if q_index < len(interview.questions):
                topic_map[q_index] = (topic.label, topic.source)
                q_index += 1
                follow_ups = max(0, (topic.questions_asked or 0) - 1)
                for _ in range(follow_ups):
                    if q_index < len(interview.questions):
                        topic_map[q_index] = (topic.label, topic.source)
                        q_index += 1

        while q_index < len(interview.questions):
            if sorted_topics:
                last_topic = sorted_topics[-1]
                topic_map[q_index] = (last_topic.label, last_topic.source)
            q_index += 1

        return topic_map

    def _get_current_topic(self, interview: Interview) -> TopicEntry | None:
        """Get the current active topic from the topic plan."""
        if not interview.current_topic_id:
            return None
        for topic in interview.topic_plan:
            if topic.id == interview.current_topic_id:
                return topic
        return None

    def _build_context(self, interview: Interview) -> PlannerContext:
        """Build minimal context for the planner."""
        current_topic = self._get_current_topic(interview)
        unvisited = [
            t for t in interview.topic_plan
            if t.status == TopicStatus.AVAILABLE
        ]
        previous_qa = []
        for i, question in enumerate(interview.questions):
            prev_answer = interview.answers.get(i)
            if prev_answer:
                previous_qa.append({
                    "question": question.text,
                    "answer": prev_answer.transcript,
                })

        previous_questions = [q.text for q in interview.questions]

        return PlannerContext(
            interview_id=str(interview.id),
            job_role=interview.job_role,
            candidate_name=interview.candidate_name,
            current_topic=current_topic,
            questions_answered=interview.answered_count,
            total_questions=interview.total_questions,
            questions_remaining=interview.total_questions - interview.answered_count,
            unvisited_topics=unvisited,
            previous_questions=previous_questions,
            previous_qa=previous_qa,
        )
