import logging
from uuid import UUID

from domain.interview import Interview, TopicStatus
from domain.question import Question, QuestionType
from domain.answer import Answer, AnswerStatus
from domain.interview_state import InterviewState
from infrastructure.repositories.base import InterviewRepositoryInterface
from application.llm_service import LLMService
from application.rag_client import RAGClient
from application.question_planner import QuestionPlanner, InterviewContext, MAX_QUESTIONS_PER_TOPIC

logger = logging.getLogger(__name__)


class InterviewService:
    def __init__(
        self,
        repository: InterviewRepositoryInterface,
        llm_service: LLMService,
        rag_client: RAGClient,
        planner: QuestionPlanner,
    ):
        self._repository = repository
        self._llm = llm_service
        self._rag = rag_client
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

        topics = self._llm.extract_resume_topics(
            resume_text=resume_text,
            job_role=job_role,
            count=total_questions,
        )
        interview.topics = topics

        context = InterviewContext(
            interview_id=str(interview.id),
            job_role=job_role,
            candidate_name=candidate_name,
            questions_asked=0,
            total_questions=total_questions,
            previous_qa=[],
            topics_remaining=list(interview.topics),
            topics_covered=[],
            current_question_type=None,
            follow_up_depth=0,
        )

        question_text, q_type, topic_label = await self._planner.generate_next_question(context)

        interview.questions.append(
            Question(text=question_text, question_type=q_type, order=0)
        )

        if topic_label and topic_label in interview.topics:
            interview.topics.remove(topic_label)
            interview.topics_covered.append(topic_label)
            interview.topic_status[topic_label] = TopicStatus.ACTIVE.value

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

        # Step 1: Classify the answer
        answer_status, next_action, clarification = await self._classify_answer(
            interview=interview,
            current_question=current_q.text if current_q else "",
            transcript=transcript,
            current_topic=current_topic,
        )

        answer.answer_status = AnswerStatus(answer_status)
        logger.info(
            "[INTERVIEW] Answer classified: status=%s, action=%s, topic=%s",
            answer_status, next_action, current_topic,
        )

        # Step 2: Handle clarification — don't count as new question
        if next_action == "CLARIFY":
            interview.status = InterviewState.WAITING_FOR_ANSWER
            await self._repository.save(interview)
            return {
                "interview_id": str(interview.id),
                "question_index": interview.current_question_index,
                "answered_count": interview.answered_count,
                "status": interview.status.value,
                "next_question": clarification or current_q.text if current_q else "",
                "next_question_index": interview.current_question_index,
                "total_questions": interview.total_questions,
                "is_clarification": True,
                "analysis": None,
            }

        # Step 3: Update topic state
        self._update_topic_state(interview, current_topic, answer_status)

        # Step 4: Decide next question
        if len(interview.questions) < interview.total_questions:
            previous_qa = self._build_previous_qa(interview)

            follow_up_depth = 0
            for qa in reversed(previous_qa):
                if qa["question_type"] == QuestionType.FOLLOW_UP.value:
                    follow_up_depth += 1
                else:
                    break

            current_q_type = interview.questions[-1].question_type if interview.questions else None

            context = InterviewContext(
                interview_id=str(interview.id),
                job_role=interview.job_role,
                candidate_name=interview.candidate_name,
                questions_asked=len(interview.questions),
                total_questions=interview.total_questions,
                previous_qa=previous_qa,
                topics_remaining=list(interview.topics),
                topics_covered=list(interview.topics_covered),
                current_question_type=current_q_type,
                follow_up_depth=follow_up_depth,
                last_answer_status=answer_status,
                topic_status=dict(interview.topic_status),
                questions_per_topic=dict(interview.questions_per_topic),
                last_answer=transcript,
                current_topic=current_topic,
                next_action=next_action,
            )

            question_text, q_type, topic_label = await self._planner.generate_next_question(context)

            new_index = len(interview.questions)
            interview.questions.append(
                Question(text=question_text, question_type=q_type, order=new_index)
            )

            if topic_label and topic_label in interview.topics:
                interview.topics.remove(topic_label)
                interview.topics_covered.append(topic_label)
                if topic_label not in interview.topic_status:
                    interview.topic_status[topic_label] = TopicStatus.ACTIVE.value

            interview.advance()
        else:
            interview.status = InterviewState.COMPLETED

        await self._repository.save(interview)

        # Generate analysis after interview completes
        if interview.status == InterviewState.COMPLETED and interview.analysis is None:
            try:
                from application.analysis_service import AnalysisService
                analysis_service = AnalysisService(llm=self._llm)
                interview.analysis = await analysis_service.analyze(interview)
                await self._repository.save(interview)
            except Exception as e:
                logger.error("Analysis failed for interview %s: %s", interview.id, e)
                interview.analysis = None

        is_complete = interview.status == InterviewState.COMPLETED
        q = interview.current_question()
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

    def _get_current_topic(self, interview: Interview) -> str:
        if not interview.topics_covered:
            return interview.topics[0] if interview.topics else interview.job_role
        return interview.topics_covered[-1]

    def _build_previous_qa(self, interview: Interview) -> list[dict]:
        previous_qa = []
        for i, question in enumerate(interview.questions):
            prev_answer = interview.answers.get(i)
            if prev_answer:
                previous_qa.append({
                    "question": question.text,
                    "answer": prev_answer.transcript,
                    "question_type": question.question_type.value,
                })
        return previous_qa

    async def _classify_answer(
        self,
        interview: Interview,
        current_question: str,
        transcript: str,
        current_topic: str,
    ) -> tuple[str, str, str | None]:
        """Classify the answer and decide next action.

        Returns (answer_status, next_action, clarification_text).
        """
        # Step 1: Rule-based pre-classification for obvious cases
        rule_result = self._llm.classify_answer_rule_based(transcript)

        if rule_result == "NEEDS_CLARIFICATION":
            # For obvious clarification, rephrase the same question
            clarification = f"Let me rephrase that. {current_question}"
            return "NEEDS_CLARIFICATION", "CLARIFY", clarification

        if rule_result == "DOES_NOT_KNOW":
            return "DOES_NOT_KNOW", "NEW_TOPIC", None

        # Step 2: LLM classification for ambiguous cases
        previous_qa = self._build_previous_qa(interview)
        recent_topics = interview.topics_covered[-4:] if interview.topics_covered else []

        questions_on_topic = interview.questions_per_topic.get(current_topic, 0)

        try:
            chunks = await self._rag.retrieve_context(
                query=transcript,
                interview_id=str(interview.id),
                top_k=3,
            )
        except Exception:
            chunks = []

        classification = self._llm.classify_and_plan_next(
            job_role=interview.job_role,
            current_question=current_question,
            candidate_answer=transcript,
            current_topic=current_topic,
            questions_on_topic=questions_on_topic,
            recent_topics=recent_topics,
            topics_remaining=interview.topics,
            context_chunks=chunks,
            interview_history=previous_qa,
        )

        return (
            classification["answer_status"],
            classification["next_action"],
            classification.get("clarification"),
        )

    def _update_topic_state(
        self,
        interview: Interview,
        current_topic: str,
        answer_status: str,
    ) -> None:
        if answer_status == "DOES_NOT_KNOW":
            interview.topic_status[current_topic] = TopicStatus.EXHAUSTED.value
            if current_topic in interview.topics:
                interview.topics.remove(current_topic)
            logger.info("[INTERVIEW] Topic %s EXHAUSTED (DOES_NOT_KNOW)", current_topic)

        elif answer_status in ("ANSWERED", "PARTIAL_ANSWER"):
            count = interview.questions_per_topic.get(current_topic, 0) + 1
            interview.questions_per_topic[current_topic] = count

            if count >= MAX_QUESTIONS_PER_TOPIC:
                interview.topic_status[current_topic] = TopicStatus.EXHAUSTED.value
                logger.info("[INTERVIEW] Topic %s EXHAUSTED (max questions reached)", current_topic)
            else:
                interview.topic_status[current_topic] = TopicStatus.ACTIVE.value
