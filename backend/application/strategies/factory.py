from domain.interview_mode import InterviewMode
from application.strategies.base import InterviewStrategy
from application.strategies.resume_deep_dive import ResumeDeepDiveStrategy
from application.strategies.behavioral import BehavioralStrategy
from application.strategies.hr_screening import HRScreeningStrategy
from application.strategies.mixed import MixedInterviewStrategy

_STRATEGIES: dict[InterviewMode, type[InterviewStrategy]] = {
    InterviewMode.RESUME_DEEP_DIVE: ResumeDeepDiveStrategy,
    InterviewMode.BEHAVIORAL: BehavioralStrategy,
    InterviewMode.HR_SCREENING: HRScreeningStrategy,
    InterviewMode.MIXED: MixedInterviewStrategy,
}


class InterviewStrategyFactory:
    @staticmethod
    def get(mode: InterviewMode) -> InterviewStrategy:
        strategy_cls = _STRATEGIES.get(mode)
        if not strategy_cls:
            raise ValueError(f"Unsupported interview mode: {mode}")
        return strategy_cls()
