from application.strategies.base import InterviewStrategy


class MixedInterviewStrategy(InterviewStrategy):
    def get_initial_planning_instructions(self) -> str:
        return (
            "Interview mode: Mixed Interview.\n\n"
            "Create a realistic end-to-end software engineering interview combining:\n"
            "- Resume / work experience\n"
            "- Technical skills\n"
            "- HR / motivation\n\n"
            "For a 10-question interview, aim approximately for:\n"
            "- 5 Resume / Experience questions\n"
            "- 3 Technical questions\n"
            "- 2 HR questions\n\n"
            "Maintain reasonable distribution instead of clustering all questions in one category.\n\n"
            "Resume questions must preserve project and experience boundaries.\n\n"
            "Technical questions should probe depth on skills mentioned in the Resume and JD.\n\n"
            "HR questions should remain conversational.\n\n"
            "Do not create DSA/coding questions requiring a code editor.\n\n"
            "The interview should feel like one realistic interview rather than unrelated "
            "question categories.\n\n"
            "Example topic types:\n"
            'Resume: "Tell me about the biggest technical challenge you faced in MergePilot."\n'
            'Technical: "How does your caching layer handle cache invalidation under high write throughput?"\n'
            'HR: "What are you looking for in your next role?"'
        )

    def get_runtime_instructions(self) -> str:
        return (
            "INTERVIEW MODE: Mixed Interview.\n\n"
            "Respect the category of the current question:\n"
            "- Resume question: stay focused on the candidate's experience.\n"
            "- Technical question: stay focused on implementation depth and trade-offs.\n"
            "- HR question: stay conversational.\n\n"
            "Maintain the intended mixed interview balance."
        )

    def get_evaluation_instructions(self) -> str:
        return (
            "EVALUATION MODE: Mixed Interview.\n\n"
            "Evaluate across all dimensions:\n"
            "- technical_depth for resume/experience questions\n"
            "- correctness and depth for technical questions\n"
            "- clarity and motivation for HR questions\n\n"
            "Balance the evaluation across technical, depth, and communication dimensions."
        )
