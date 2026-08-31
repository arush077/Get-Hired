from application.strategies.base import InterviewStrategy


class BehavioralStrategy(InterviewStrategy):
    def get_initial_planning_instructions(self) -> str:
        return (
            "Interview mode: Behavioral.\n\n"
            "Focus on how the candidate behaves, communicates, and makes decisions in real "
            "working situations.\n\n"
            "Prioritize:\n"
            "- ownership\n"
            "- teamwork\n"
            "- conflict\n"
            "- leadership\n"
            "- failure\n"
            "- ambiguity\n"
            "- difficult decisions\n"
            "- communication\n"
            "- receiving feedback\n"
            "- handling mistakes\n"
            "- learning and growth\n\n"
            "Prefer questions grounded in real experiences mentioned in the candidate's Resume.\n\n"
            "Questions should naturally encourage the candidate to explain:\n"
            "- the situation\n"
            "- the problem\n"
            "- what they personally did\n"
            "- the outcome\n"
            "- what they learned\n\n"
            "Do not require the candidate to explicitly use the words 'STAR'.\n\n"
            "Avoid deep technical implementation questions unless technical context is "
            "necessary to understand the behavioral situation.\n\n"
            "Example style:\n"
            '"Tell me about a time you disagreed with a teammate about a technical decision. '
            'How did you handle the situation, and what was the outcome?"'
        )

    def get_runtime_instructions(self) -> str:
        return (
            "INTERVIEW MODE: Behavioral.\n\n"
            "Focus follow-ups on:\n"
            "- what the candidate personally did\n"
            "- decision-making\n"
            "- communication\n"
            "- conflict handling\n"
            "- outcome\n"
            "- lessons learned\n\n"
            "Push vague answers toward concrete examples."
        )

    def get_evaluation_instructions(self) -> str:
        return (
            "EVALUATION MODE: Behavioral.\n\n"
            "Focus evaluation on:\n"
            "- quality of real-world examples provided\n"
            "- self-awareness and reflection\n"
            "- communication structure and clarity\n"
            "- demonstrated growth and learning\n"
            "- ability to handle ambiguity and conflict\n"
            "- ownership and accountability\n\n"
            "Weight communication and specificity more heavily than technical_depth."
        )
