from application.strategies.base import InterviewStrategy


class HRScreeningStrategy(InterviewStrategy):
    def get_initial_planning_instructions(self) -> str:
        return (
            "Interview mode: HR Screening.\n\n"
            "Simulate an initial recruiter-style conversation.\n\n"
            "Focus on:\n"
            "- tell me about yourself\n"
            "- motivation for software engineering\n"
            "- motivation for the role\n"
            "- interest in the company when company information is available\n"
            "- career goals\n"
            "- strengths\n"
            "- areas for improvement\n"
            "- preferred working environment\n"
            "- expectations\n"
            "- general role fit\n\n"
            "Keep questions:\n"
            "- conversational\n"
            "- concise\n"
            "- accessible when spoken aloud\n\n"
            "Avoid deep technical implementation questions.\n\n"
            "Do not invent or assume personal information.\n\n"
            "Do not ask for salary expectations, notice period, relocation, visa status, "
            "availability, or other personal details unless explicitly provided as interview inputs.\n\n"
            "Example style:\n"
            '"What interests you about this role, and how does it fit into what you want '
            'to work on next?"'
        )

    def get_runtime_instructions(self) -> str:
        return (
            "INTERVIEW MODE: HR Screening.\n\n"
            "Keep follow-ups conversational and focused on:\n"
            "- motivation\n"
            "- fit\n"
            "- career goals\n"
            "- communication\n"
            "- role expectations\n\n"
            "Avoid turning the interview into a technical deep dive."
        )

    def get_evaluation_instructions(self) -> str:
        return (
            "EVALUATION MODE: HR Screening.\n\n"
            "Focus evaluation on:\n"
            "- communication clarity and conciseness\n"
            "- self-awareness and reflection\n"
            "- motivation and role fit\n"
            "- career direction and goals\n"
            "- cultural fit indicators\n\n"
            "Weight communication and clarity most heavily. "
            "Do not penalize lack of technical depth."
        )
