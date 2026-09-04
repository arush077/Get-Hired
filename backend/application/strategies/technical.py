from application.strategies.base import InterviewStrategy


class TechnicalStrategy(InterviewStrategy):
    def get_initial_planning_instructions(self) -> str:
        return (
            "Interview mode: Technical.\n\n"
            "Focus on the candidate's technical skills mentioned in their Resume and the "
            "Job Description. Probe depth of understanding, not surface-level knowledge.\n\n"
            "Prioritize:\n"
            "- technical skills and tools listed in the Resume and JD\n"
            "- system design and architecture decisions\n"
            "- data structures and algorithms relevant to the role\n"
            "- debugging and problem-solving approaches\n"
            "- trade-offs between technical approaches\n"
            "- performance optimization\n"
            "- code quality and best practices\n"
            "- familiarity with relevant frameworks, libraries, and infrastructure\n\n"
            "Questions should be grounded in the candidate's Resume and the JD requirements.\n\n"
            "Do NOT ask generic textbook questions unless the JD explicitly requires that skill.\n\n"
            "For each technical skill or project mentioned, ask about:\n"
            "- how it works under the hood\n"
            "- why it was chosen over alternatives\n"
            "- what problems it solves\n"
            "- edge cases and failure modes\n"
            "- how the candidate would improve it\n\n"
            "Example style:\n"
            '"Your Resume mentions using Redis for caching. Walk me through your caching '
            'strategy — what data did you cache, how did you handle cache invalidation, and '
            'what was the measurable impact on response times?"'
        )

    def get_runtime_instructions(self) -> str:
        return (
            "INTERVIEW MODE: Technical.\n\n"
            "Focus follow-ups on:\n"
            "- implementation details and internals\n"
            "- why a specific technology or approach was chosen\n"
            "- trade-offs and alternatives considered\n"
            "- edge cases and failure handling\n"
            "- performance characteristics\n"
            "- how it connects to the JD requirements\n\n"
            "Push vague answers like 'I used X' toward concrete technical depth: "
            "how X works, why X over Y, what broke, and how it was fixed."
        )

    def get_evaluation_instructions(self) -> str:
        return (
            "EVALUATION MODE: Technical.\n\n"
            "Focus evaluation on:\n"
            "- depth of technical understanding (not just naming tools)\n"
            "- correctness of technical claims\n"
            "- specificity of implementation details\n"
            "- ability to reason about trade-offs\n"
            "- problem-solving approach\n"
            "- awareness of edge cases and failure modes\n\n"
            "Weight technical_depth and correctness more heavily than communication."
        )
