from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from domain.question import QuestionType
from application.llm_service import LLMService
from application.rag_client import RAGClient

MAX_QUESTIONS_PER_TOPIC = 2


@dataclass
class InterviewContext:
    interview_id: str
    job_role: str
    candidate_name: str
    questions_asked: int
    total_questions: int
    previous_qa: list[dict]
    topics_remaining: list[str]
    topics_covered: list[str]
    current_question_type: QuestionType | None
    follow_up_depth: int
    # Adaptive fields
    last_answer_status: str | None = None
    topic_status: dict[str, str] = field(default_factory=dict)
    questions_per_topic: dict[str, int] = field(default_factory=dict)
    last_answer: str = ""
    current_topic: str = ""
    next_action: str | None = None


class QuestionStrategy(ABC):
    @abstractmethod
    async def generate(
        self, context: InterviewContext, rag: RAGClient, llm: LLMService
    ) -> tuple[str, str]:
        """Returns (question_text, topic_label)."""
        pass


class HRQuestionStrategy(QuestionStrategy):
    _variants = ["introductory", "motivational"]

    async def generate(
        self, context: InterviewContext, rag: RAGClient, llm: LLMService
    ) -> tuple[str, str]:
        variant_idx = min(context.questions_asked, len(self._variants) - 1)
        variant = self._variants[variant_idx]
        question_text = llm.generate_hr_question(
            candidate_name=context.candidate_name,
            job_role=context.job_role,
            variant=variant,
        )
        return question_text, ""


class PrimaryQuestionStrategy(QuestionStrategy):
    async def generate(
        self, context: InterviewContext, rag: RAGClient, llm: LLMService
    ) -> tuple[str, str]:
        search_angle = await self._select_best_topic(context, rag)

        chunks = await rag.retrieve_context(
            query=search_angle,
            interview_id=context.interview_id,
            top_k=3,
        )

        question_text = llm.generate_primary_question(
            job_role=context.job_role,
            search_angle=search_angle,
            context_chunks=chunks,
            topics_covered=context.topics_covered,
        )

        return question_text, search_angle

    async def _select_best_topic(
        self, context: InterviewContext, rag: RAGClient
    ) -> str:
        if not context.topics_remaining:
            return context.job_role

        best_topic = context.topics_remaining[0]
        best_score = 0

        for topic in context.topics_remaining[:5]:
            try:
                chunks = await rag.retrieve_context(
                    query=topic,
                    interview_id=context.interview_id,
                    top_k=1,
                )
                score = len(chunks)
                if len(topic.split()) >= 2:
                    score += 1
                if score > best_score:
                    best_score = score
                    best_topic = topic
            except Exception:
                continue

        return best_topic


class FollowUpQuestionStrategy(QuestionStrategy):
    async def generate(
        self, context: InterviewContext, rag: RAGClient, llm: LLMService
    ) -> tuple[str, str]:
        last_qa = context.previous_qa[-1]
        last_question = last_qa["question"]
        last_answer = last_qa["answer"]

        chunks = await rag.retrieve_context(
            query=last_answer,
            interview_id=context.interview_id,
            top_k=3,
        )

        question_text = llm.generate_follow_up_question(
            job_role=context.job_role,
            previous_question=last_question,
            previous_answer=last_answer,
            context_chunks=chunks,
        )

        return question_text, ""


class QuestionPlanner:
    def __init__(
        self,
        rag: RAGClient,
        llm: LLMService,
    ):
        self._rag = rag
        self._llm = llm
        self._strategies: dict[QuestionType, QuestionStrategy] = {
            QuestionType.HR: HRQuestionStrategy(),
            QuestionType.PRIMARY: PrimaryQuestionStrategy(),
            QuestionType.FOLLOW_UP: FollowUpQuestionStrategy(),
        }

    def _get_exhausted_topics(self, context: InterviewContext) -> set[str]:
        return {
            topic for topic, status in context.topic_status.items()
            if status == "EXHAUSTED"
        }

    def _pick_new_topic(self, context: InterviewContext) -> str:
        exhausted = self._get_exhausted_topics(context)
        available = [
            t for t in context.topics_remaining
            if t not in exhausted
        ]
        if available:
            return available[0]
        if context.topics_remaining:
            return context.topics_remaining[0]
        return context.job_role

    def _select_type(self, context: InterviewContext) -> QuestionType:
        idx = context.questions_asked

        # First 2 questions are always HR (introductory + motivational)
        if idx < 2:
            return QuestionType.HR

        # After that, use adaptive logic based on next_action
        next_action = context.next_action

        if next_action == "FOLLOW_UP":
            questions_on_topic = context.questions_per_topic.get(context.current_topic, 0)
            if questions_on_topic < MAX_QUESTIONS_PER_TOPIC:
                return QuestionType.FOLLOW_UP

        # Default: new topic
        return QuestionType.PRIMARY

    async def generate_next_question(
        self, context: InterviewContext
    ) -> tuple[str, QuestionType, str]:
        q_type = self._select_type(context)

        if q_type == QuestionType.HR:
            strategy = self._strategies[QuestionType.HR]
            question_text, topic_label = await strategy.generate(context, self._rag, self._llm)
            return question_text, q_type, topic_label

        if q_type == QuestionType.FOLLOW_UP:
            strategy = self._strategies[QuestionType.FOLLOW_UP]
            question_text, topic_label = await strategy.generate(context, self._rag, self._llm)
            return question_text, q_type, context.current_topic

        # PRIMARY — new topic
        strategy = self._strategies[QuestionType.PRIMARY]
        question_text, topic_label = await strategy.generate(context, self._rag, self._llm)
        return question_text, q_type, topic_label
