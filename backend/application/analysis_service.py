import logging

from domain.interview import Interview

logger = logging.getLogger(__name__)


class AnalysisService:
    def __init__(self, llm):
        self._llm = llm

    async def analyze(self, interview: Interview) -> dict:
        sorted_questions = sorted(interview.questions, key=lambda q: q.order)

        # Build topic lookup: question index -> topic
        topic_map = self._build_topic_map(interview)

        # Build structured question metadata
        questions_meta = []
        for i, question in enumerate(sorted_questions):
            topic_label, topic_source = topic_map.get(i, ("", ""))
            questions_meta.append({
                "index": i,
                "text": question.text,
                "type": question.question_type.value,
                "topic_label": topic_label,
                "topic_source": topic_source,
            })

        # Build structured answer metadata
        answers_meta = []
        has_answer = False
        for i, question in enumerate(sorted_questions):
            answer = interview.answers.get(i)
            transcript = answer.transcript if answer else ""
            if transcript.strip():
                has_answer = True
            answers_meta.append({
                "index": i,
                "transcript": transcript or "(no answer captured)",
                "answer_status": answer.answer_status.value if answer and answer.answer_status else None,
            })

        if not has_answer:
            return {
                "overall_score": 0,
                "dimensions": {},
                "strengths": [],
                "areas_to_improve": [
                    "Provide complete, detailed responses to interview questions",
                    "Demonstrate technical knowledge and examples in answers",
                ],
                "recurring_patterns": [],
                "question_feedback": [],
                "recommendations": [],
                "jd_match": None,
            }

        interview_context = {
            "resume_text": interview.resume_snapshot,
            "jd_text": interview.jd_snapshot,
            "job_role": interview.job_role,
            "questions": questions_meta,
            "answers": answers_meta,
        }

        return await self._llm.generate_analysis(interview_context)

    def _build_topic_map(self, interview: Interview) -> dict[int, tuple[str, str]]:
        """Map question index -> (topic_label, topic_source).

        Uses the topic_plan and tracks which topic was active when each
        question was asked based on exhaustion and questions_asked counts.
        """
        topic_map: dict[int, tuple[str, str]] = {}

        if not interview.topic_plan:
            return topic_map

        # Sort topics by priority to establish order
        sorted_topics = sorted(interview.topic_plan, key=lambda t: t.priority)

        # Build a mapping of topic -> question indices by simulating the interview flow
        q_index = 0
        for topic in sorted_topics:
            # Primary question index
            if q_index < len(interview.questions):
                topic_map[q_index] = (topic.label, topic.source)
                q_index += 1

                # Follow-up questions on this topic (up to questions_asked - 1)
                follow_ups = max(0, (topic.questions_asked or 0) - 1)
                for _ in range(follow_ups):
                    if q_index < len(interview.questions):
                        topic_map[q_index] = (topic.label, topic.source)
                        q_index += 1

        # Any remaining questions get the last topic or empty
        while q_index < len(interview.questions):
            if sorted_topics:
                last_topic = sorted_topics[-1]
                topic_map[q_index] = (last_topic.label, last_topic.source)
            q_index += 1

        return topic_map
