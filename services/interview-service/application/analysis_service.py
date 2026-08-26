from domain.interview import Interview
from application.llm_service import LLMService


class AnalysisService:
    def __init__(self, llm: LLMService):
        self._llm = llm

    async def analyze(self, interview: Interview) -> dict:
        sorted_questions = sorted(interview.questions, key=lambda q: q.order)

        lines = []
        for i, question in enumerate(sorted_questions):
            answer = interview.answers.get(i)
            answer_text = answer.transcript if answer else "(no answer captured)"
            lines.append(f"Q{i + 1}: {question.text}")
            lines.append(f"A{i + 1}: {answer_text}")
            lines.append("")

        transcript = "\n".join(lines).strip()
        return self._llm.generate_analysis(transcript)
