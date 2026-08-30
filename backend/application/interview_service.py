import logging
from uuid import UUID

from domain.interview import Interview
from domain.question import Question, QuestionType
from domain.answer import Answer, AnswerStatus
from domain.interview_state import InterviewState
from domain.topic import TopicEntry, TopicStatus
from infrastructure.repositories.base import InterviewRepositoryInterface
from application.llm_service import LLMService
from application.rag_service import RAGService
from application.topic_planner import build_topic_plan
from application.question_planner import QuestionPlanner, PlannerContext, MAX_QUESTIONS_PER_TOPIC

logger = logging.getLogger(__name__)


class InterviewService:
    def __init__(
        self,
        repository: InterviewRepositoryInterface,
        llm_service: LLMService,
        rag_service: RAGService,
        planner: QuestionPlanner,
    ):
        self._repository = repository
        self._llm = llm_service
        self._rag = rag_service
        self._planner = planner

    async def start_interview(
        self,
        candidate_name: str,
        job_role: str,
        resume_text: str,
        jd_text: str,
        total_questions: int = 10,
    ) -> Interview:
        interview = Interview(
            candidate_name=candidate_name,
            job_role=job_role,
            total_questions=total_questions,
        )

        await self._rag.ingest_documents(
            resume_text=resume_text,
            jd_text=jd_text,
            interview_id=str(interview.id),
        )

        topic_plan = await build_topic_plan(
            resume_text=resume_text,
            jd_text=jd_text,
            job_role=job_role,
            llm=self._llm,
            rag=self._rag,
            total_questions=total_questions,
        )
        interview.topic_plan = topic_plan
        interview.current_topic_id = topic_plan[0].id if topic_plan else None

        self._planner.reset_embeddings()

        context = self._build_context(interview)
        question_text, q_type = await self._planner.generate_question(
            context, self._rag, self._llm
        )

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
        interview = await self._repository.get(interview_id)
        if not interview:
            return None
        if not interview.status.can_accept_answer():
            return None

        answer = Answer(transcript=transcript)
        interview.submit_answer(answer)

        current_q = interview.questions[-1] if interview.questions else None
        current_topic = self._get_current_topic(interview)

        # Build context for classification
        context = self._build_context(interview)

        # RAG retrieve for classification context
        try:
            raw_chunks = await self._rag.retrieve(
                query=transcript,
                interview_id=str(interview.id),
                top_k=3,
            )
            chunks = [c.content for c in raw_chunks]
        except Exception:
            chunks = []

        # Single LLM call: classify answer + plan next action
        classification = await self._planner.classify_and_plan(
            context=context,
            question=current_q.text if current_q else "",
            answer=transcript,
            rag_chunks=chunks,
            llm=self._llm,
        )

        # Python enforces hard rules
        enforced = self._planner.apply_hard_rules(
            classification=classification,
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

        # Handle clarification — don't consume a question slot
        if enforced["next_action"] == "CLARIFY":
            interview.status = InterviewState.WAITING_FOR_ANSWER
            await self._repository.save(interview)
            return {
                "interview_id": str(interview.id),
                "question_index": interview.current_question_index,
                "answered_count": interview.answered_count,
                "status": interview.status.value,
                "next_question": enforced.get("clarification_text") or (current_q.text if current_q else ""),
                "next_question_index": interview.current_question_index,
                "total_questions": interview.total_questions,
                "is_clarification": True,
                "analysis": None,
            }

        # Handle NEW_TOPIC — exhaust current topic
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
            # Advance to next topic if needed
            if enforced["next_action"] == "NEW_TOPIC":
                next_topic_id = self._planner.advance_topic(
                    interview.topic_plan, interview.current_topic_id
                )
                interview.current_topic_id = next_topic_id

            # Build fresh context for question generation
            context = self._build_context(interview)
            question_text, q_type = await self._planner.generate_question(
                context, self._rag, self._llm
            )

            new_index = len(interview.questions)
            interview.questions.append(
                Question(text=question_text, question_type=q_type, order=new_index)
            )
            interview.advance()
        else:
            interview.status = InterviewState.COMPLETED
            is_complete = True

        await self._repository.save(interview)

        # Generate analysis after interview completes
        if interview.status == InterviewState.COMPLETED and interview.analysis is None:
            try:
                from application.analysis_service import AnalysisService
                analysis_service = AnalysisService(llm=self._llm)
                interview.analysis = await analysis_service.analyze(interview)
                await self._repository.save(interview)
            except Exception as e:
                logger.error("[INTERVIEW] Analysis failed: %s", e)

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
            "analysis": interview.analysis,
        }

    async def get_results(self, interview_id: UUID) -> dict | None:
        interview = await self._repository.get(interview_id)
        if not interview:
            return None

        results = []
        for i, question in enumerate(interview.questions):
            answer = interview.answers.get(i)
            results.append(
                {
                    "question_index": i,
                    "question": question.text,
                    "answer": answer.transcript if answer else "(no answer captured)",
                }
            )

        return {
            "interview_id": str(interview.id),
            "status": interview.status.value,
            "results": results,
            "analysis": interview.analysis,
        }

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
