from abc import ABC, abstractmethod
from dataclasses import dataclass

from domain.question import QuestionType
from application.llm_service import LLMService
from application.rag_client import RAGClient


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


DEFAULT_DISTRIBUTION = [
    QuestionType.HR,           # Q1 - introduction
    QuestionType.HR,           # Q2 - motivation
    QuestionType.PRIMARY,      # Q3
    QuestionType.PRIMARY,      # Q4
    QuestionType.FOLLOW_UP,    # Q5
    QuestionType.PRIMARY,      # Q6
    QuestionType.DEEP_DIVE,    # Q7
    QuestionType.PRIMARY,      # Q8
    QuestionType.FOLLOW_UP,    # Q9
    QuestionType.PRIMARY,      # Q10
]


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
        search_angle = context.topics_remaining[0]

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


class DeepDiveQuestionStrategy(QuestionStrategy):
    async def generate(
        self, context: InterviewContext, rag: RAGClient, llm: LLMService
    ) -> tuple[str, str]:
        topic = context.topics_covered[-1] if context.topics_covered else context.job_role

        chunks = await rag.retrieve_context(
            query=topic,
            interview_id=context.interview_id,
            top_k=3,
        )

        question_text = llm.generate_deep_dive_question(
            job_role=context.job_role,
            topic=topic,
            context_chunks=chunks,
            interview_history=context.previous_qa,
        )

        return question_text, ""


class QuestionPlanner:
    def __init__(
        self,
        rag: RAGClient,
        llm: LLMService,
        distribution: list[QuestionType] | None = None,
    ):
        self._rag = rag
        self._llm = llm
        self._distribution = distribution or DEFAULT_DISTRIBUTION
        self._strategies: dict[QuestionType, QuestionStrategy] = {
            QuestionType.HR: HRQuestionStrategy(),
            QuestionType.PRIMARY: PrimaryQuestionStrategy(),
            QuestionType.FOLLOW_UP: FollowUpQuestionStrategy(),
            QuestionType.DEEP_DIVE: DeepDiveQuestionStrategy(),
        }

    def _select_type(self, context: InterviewContext) -> QuestionType:
        idx = context.questions_asked
        planned = self._distribution[idx] if idx < len(self._distribution) else QuestionType.PRIMARY

        # HR questions are always asked as planned — no overrides
        if planned == QuestionType.HR:
            return QuestionType.HR

        if context.follow_up_depth >= 2:
            if context.topics_remaining:
                return QuestionType.PRIMARY
            return QuestionType.DEEP_DIVE

        if context.current_question_type == QuestionType.FOLLOW_UP and planned == QuestionType.FOLLOW_UP:
            if context.topics_remaining:
                return QuestionType.PRIMARY
            return QuestionType.DEEP_DIVE

        if not context.topics_remaining and planned == QuestionType.PRIMARY:
            return QuestionType.DEEP_DIVE

        return planned

    async def generate_next_question(
        self, context: InterviewContext
    ) -> tuple[str, QuestionType, str]:
        q_type = self._select_type(context)
        strategy = self._strategies[q_type]
        question_text, topic_label = await strategy.generate(context, self._rag, self._llm)
        return question_text, q_type, topic_label
