from application.strategies.base import InterviewStrategy


class MixedInterviewStrategy(InterviewStrategy):
    def get_initial_planning_instructions(self) -> str:
        return (
            "Interview mode: Mixed Interview.\n\n"
            "Create a realistic end-to-end software engineering interview combining:\n"
            "- Resume / work experience\n"
            "- Behavioral\n"
            "- HR / motivation\n\n"
            "For a 10-question interview, aim approximately for:\n"
            "- 5 Resume / Experience questions\n"
            "- 3 Behavioral questions\n"
            "- 2 HR questions\n\n"
            "Maintain reasonable distribution instead of clustering all questions in one category.\n\n"
            "Resume questions must preserve project and experience boundaries.\n\n"
            "Behavioral questions should preferably use real experiences from the Resume.\n\n"
            "HR questions should remain conversational.\n\n"
            "Do not create DSA/coding questions requiring a code editor.\n\n"
            "The interview should feel like one realistic interview rather than unrelated "
            "question categories.\n\n"
            "Example topic types:\n"
            'Resume: "Tell me about the biggest technical challenge you faced in MergePilot."\n'
            'Behavioral: "Tell me about a time you had to handle a difficult technical disagreement."\n'
            'HR: "What are you looking for in your next role?"'
        )

    def get_runtime_instructions(self) -> str:
        return (
            "INTERVIEW MODE: Mixed Interview.\n\n"
            "Respect the category of the current question:\n"
            "- Resume question: stay focused on the candidate's experience.\n"
            "- Behavioral question: stay focused on the situation and behavior.\n"
            "- HR question: stay conversational.\n\n"
            "Maintain the intended mixed interview balance."
        )

    def get_evaluation_instructions(self) -> str:
        return (
            "EVALUATION MODE: Mixed Interview.\n\n"
            "Evaluate across all dimensions:\n"
            "- technical_depth for resume/experience questions\n"
            "- communication and self-awareness for behavioral questions\n"
            "- clarity and motivation for HR questions\n\n"
            "Balance the evaluation across technical, behavioral, and communication dimensions."
        )
