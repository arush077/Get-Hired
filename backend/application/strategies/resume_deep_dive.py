from application.strategies.base import InterviewStrategy


class ResumeDeepDiveStrategy(InterviewStrategy):
    def get_initial_planning_instructions(self) -> str:
        return (
            "Interview mode: Resume Deep Dive.\n\n"
            "Focus primarily on the candidate's actual work experience and projects.\n\n"
            "Prioritize:\n"
            "- what the candidate personally built\n"
            "- ownership and responsibility\n"
            "- technical implementation decisions\n"
            "- architecture and design choices\n"
            "- trade-offs\n"
            "- debugging and difficult engineering problems\n"
            "- measurable impact\n"
            "- why a particular approach was chosen\n\n"
            "Questions should investigate the candidate's actual involvement rather than "
            "asking generic textbook questions.\n\n"
            "Prefer questions about:\n"
            "- what problem the candidate was solving\n"
            "- why a particular approach was chosen\n"
            "- alternatives considered\n"
            "- trade-offs\n"
            "- difficult implementation details\n"
            "- debugging\n"
            "- measurable outcomes\n"
            "- what the candidate would change now\n\n"
            "Every resume-grounded topic must clearly belong to one specific project, "
            "company, internship, or work experience.\n\n"
            "Never combine facts from multiple unrelated projects into one question.\n\n"
            "Avoid generic CS questions unless they are directly relevant to something "
            "the candidate actually worked on or the JD strongly requires.\n\n"
            "Example style:\n"
            '"You mentioned moving Uber\'s gig-listing page to server-side pagination. '
            "What problem were you seeing with the original approach, and how did the new "
            'design address it?"'
        )

    def get_runtime_instructions(self) -> str:
        return (
            "INTERVIEW MODE: Resume Deep Dive.\n\n"
            "Focus follow-ups on:\n"
            "- implementation details\n"
            "- ownership\n"
            "- reasoning behind decisions\n"
            "- trade-offs\n"
            "- debugging\n"
            "- measurable impact\n"
            "- concrete examples\n\n"
            "Follow-ups should deepen the current project/experience instead of jumping to "
            "generic theory."
        )

    def get_evaluation_instructions(self) -> str:
        return (
            "EVALUATION MODE: Resume Deep Dive.\n\n"
            "Focus evaluation on:\n"
            "- depth of technical understanding demonstrated\n"
            "- specificity of examples and implementation details\n"
            "- ownership and personal contribution vs team effort\n"
            "- reasoning behind technical decisions\n"
            "- awareness of trade-offs and alternatives\n"
            "- problem-solving approach and debugging skills\n\n"
            "Weight technical_depth and specificity more heavily than communication."
        )
