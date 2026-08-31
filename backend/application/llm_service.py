import json
import logging
import os
import re

from dotenv import load_dotenv
from groq import AsyncGroq

load_dotenv()

logger = logging.getLogger(__name__)

GROQ_MODEL = "openai/gpt-oss-120b"
MAX_RETRIES = 3

CONCISENESS_INSTRUCTION = (
    "Ask ONE concise interview question (15-35 words). "
    "Focus on ONE concept. Do not combine multiple questions or requirements. "
    "Do not list topics to discuss — ask a single focused question. "
)


class LLMService:
    def __init__(self):
        self._client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))

    async def _chat(self, messages: list[dict], max_tokens: int = 512) -> str:
        response = await self._client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content.strip()

    async def generate_content(self, prompt: str) -> str:
        """Generate content from a single prompt (used for resume AI features)."""
        messages = [{"role": "user", "content": prompt}]
        return await self._chat(messages, max_tokens=1024)

    def _parse_json(self, text: str) -> dict:
        if "```" in text:
            match = re.search(r"```(?:json)?\s*\n?(.*?)```", text, re.DOTALL)
            if match:
                text = match.group(1).strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            candidate = match.group(0)
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                if not candidate.endswith("}"):
                    candidate += "}"
                try:
                    return json.loads(candidate)
                except json.JSONDecodeError:
                    pass

        raise ValueError(f"Could not parse JSON from LLM response: {text[:200]}")

    def _validate_question(self, text: str) -> bool:
        if not text or len(text.strip()) == 0:
            return False
        text = text.strip()
        if text.startswith("{") or text.startswith("```"):
            return False
        if len(text) > 400:
            return False
        word_count = len(text.split())
        if word_count < 3 or word_count > 60:
            return False
        return True

    async def _generate_with_retry(self, messages: list[dict], max_tokens: int = 512) -> str:
        for attempt in range(MAX_RETRIES):
            raw = await self._chat(messages, max_tokens=max_tokens)
            try:
                data = self._parse_json(raw)
                question = data.get("question", "")
                if self._validate_question(question):
                    return question
                logger.warning(
                    "[LLM] question validation failed (attempt %d): %r",
                    attempt + 1, question[:100],
                )
            except (ValueError, KeyError) as e:
                logger.warning(
                    "[LLM] JSON parse failed (attempt %d): %s | raw: %r",
                    attempt + 1, e, raw[:200],
                )

            if attempt == MAX_RETRIES - 1:
                match = re.search(r'"question"\s*:\s*"([^"]+)"', raw)
                if match and self._validate_question(match.group(1)):
                    return match.group(1)
                match = re.search(r"([A-Z][^.?!]{10,200}[.?!])", raw)
                if match and self._validate_question(match.group(1)):
                    return match.group(1)
                logger.error(
                    "[LLM] all retries exhausted, using fallback. Last raw: %r",
                    raw[:300],
                )
        return "Can you tell me more about your experience?"

    async def generate_hr_question(self, candidate_name: str, job_role: str, variant: str) -> str:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a friendly technical interviewer. "
                    f"Generate ONE {variant} interview question for a candidate "
                    f"named {candidate_name} who is interviewing for {job_role}. "
                    "Keep it conversational and concise (15-30 words). "
                    "Do NOT ask technical questions — this is an HR/personal question. "
                    "Ask only ONE question, not multiple. "
                    'Return ONLY valid JSON: {"question": "..."}'
                ),
            },
            {
                "role": "user",
                "content": f"Generate a {variant} question for {candidate_name}.",
            },
        ]
        return await self._generate_with_retry(messages)

    async def classify_and_decide(
        self,
        resume_text: str,
        jd_text: str,
        job_role: str,
        current_topic_label: str,
        current_topic_source: str,
        current_question: str,
        candidate_answer: str,
        questions_on_topic: int,
        topics_remaining: list[str],
        interview_history: list[dict],
        previously_asked_questions: list[str],
        next_topic_id: str | None = None,
    ) -> dict:
        """ONE LLM call: classify answer + decide action + generate follow-up if needed.

        Returns:
            {
                "answer_status": "ANSWERED" | "PARTIAL_ANSWER" | "DOES_NOT_KNOW" | "NEEDS_CLARIFICATION",
                "next_action": "FOLLOW_UP" | "NEW_TOPIC" | "CLARIFY" | "END",
                "next_topic_id": str | null,
                "reason": "...",
                "question": "..." (when next_action=FOLLOW_UP),
                "clarification_text": "..." (only when next_action=CLARIFY)
            }
        """
        remaining_text = ", ".join(topics_remaining[:8]) if topics_remaining else "none remaining"
        asked_text = "\n".join(f"- {q}" for q in previously_asked_questions[-5:]) if previously_asked_questions else "none yet"
        history_text = ""
        for i, qa in enumerate(interview_history[-3:]):
            history_text += f"Q{i+1}: {qa['question']}\nA{i+1}: {qa['answer']}\n\n"

        messages = [
            {
                "role": "system",
                "content": (
                    "You are an expert interview analyst. Analyze the candidate's answer and decide what to do next.\n\n"

                    "STEP 1: Classify the answer status:\n"
                    "- ANSWERED: Candidate provided a meaningful answer with substance\n"
                    "- PARTIAL_ANSWER: Candidate started answering but it's incomplete or lacks detail\n"
                    "- DOES_NOT_KNOW: Candidate explicitly says they don't know, have no experience, weren't involved, or someone else handled it\n"
                    "- NEEDS_CLARIFICATION: Candidate is asking what the question means or asking for clarification\n\n"

                    "STEP 2: Decide the next action:\n"
                    "- FOLLOW_UP: Answer is incomplete or interesting — ask a deeper follow-up on the SAME topic. "
                    "Generate the follow-up question in the 'question' field.\n"
                    "- NEW_TOPIC: Answer is sufficient, topic is explored, or candidate doesn't know. Move on.\n"
                    "- CLARIFY: Candidate didn't understand. Generate a genuine rephrasing in 'clarification_text'.\n"
                    "- END: Interview is complete.\n\n"

                    "PROVENANCE RULES — CRITICAL:\n"
                    f"- The current topic is about: {current_topic_source}\n"
                    "- ONLY use facts from the Resume/JD context provided below.\n"
                    "- NEVER invent candidate experience, projects, technologies, responsibilities, or achievements.\n"
                    "- NEVER mix facts from different projects, jobs, or resume sections.\n"
                    "- If the context mentions a specific tool or metric for THIS topic, you may reference it.\n"
                    "- Do NOT reference tools, metrics, or responsibilities from OTHER projects or experiences.\n\n"

                    "RULES:\n"
                    "- If answer_status is DOES_NOT_KNOW, next_action MUST be NEW_TOPIC.\n"
                    "- If answer_status is NEEDS_CLARIFICATION, next_action MUST be CLARIFY.\n"
                    f"- If questions_on_topic >= 2, next_action MUST be NEW_TOPIC (hard cap).\n"
                    "- Prefer topic diversity. Don't stay on the same topic unless the follow-up is truly valuable.\n"
                    "- IMPORTANT: 'no' or 'did not' in a substantive answer is NOT DOES_NOT_KNOW.\n"
                    "- For FOLLOW_UP: generate a question (15-35 words) grounded in the resume evidence for this topic.\n"
                    "- For CLARIFY: genuinely rephrase the question. Do NOT just prepend 'Let me rephrase that.'.\n"
                    "- For NEW_TOPIC: suggest next_topic_id from available topics if possible.\n\n"

                    f"Current topic: {current_topic_label} ({current_topic_source})\n"
                    f"Questions asked on this topic: {questions_on_topic}\n"
                    f"Available topics: {remaining_text}\n"
                    f"Previously asked questions:\n{asked_text}\n\n"

                    'Return ONLY valid JSON: {"answer_status": "...", "next_action": "...", "next_topic_id": null, '
                    '"reason": "...", "question": null, "clarification_text": null}\n'
                    "- question: filled only when next_action is FOLLOW_UP\n"
                    "- clarification_text: filled only when next_action is CLARIFY\n"
                    "- next_topic_id: suggested topic for NEW_TOPIC, or null\n"
                    "- reason: one sentence for debugging"
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Job Role: {job_role}\n\n"
                    f"=== CANDIDATE RESUME ===\n{resume_text}\n\n"
                    f"=== JOB DESCRIPTION ===\n{jd_text}\n\n"
                    f"Current Question: {current_question}\n"
                    f"Candidate Answer: {candidate_answer}\n\n"
                    f"Recent Interview History:\n{history_text}"
                ),
            },
        ]

        raw = await self._chat(messages, max_tokens=1024)
        try:
            data = self._parse_json(raw)
            answer_status = data.get("answer_status", "ANSWERED")
            next_action = data.get("next_action", "NEW_TOPIC")
            clarification_text = data.get("clarification_text")
            question = data.get("question")
            next_topic_id = data.get("next_topic_id")

            if answer_status not in ("ANSWERED", "PARTIAL_ANSWER", "DOES_NOT_KNOW", "NEEDS_CLARIFICATION"):
                answer_status = "ANSWERED"
            if next_action not in ("FOLLOW_UP", "NEW_TOPIC", "CLARIFY", "END"):
                next_action = "NEW_TOPIC"

            return {
                "answer_status": answer_status,
                "next_action": next_action,
                "next_topic_id": next_topic_id,
                "reason": data.get("reason", ""),
                "question": question if next_action == "FOLLOW_UP" else None,
                "clarification_text": clarification_text if next_action == "CLARIFY" else None,
            }
        except (ValueError, KeyError) as e:
            logger.warning("[LLM] classify_and_decide parse failed: %s | raw: %r", e, raw[:200])
            return {
                "answer_status": "ANSWERED",
                "next_action": "NEW_TOPIC",
                "next_topic_id": None,
                "reason": f"Parse failed: {e}",
                "question": None,
                "clarification_text": None,
            }

    async def generate_analysis(self, interview_context: dict) -> dict:
        """Generate structured analysis from rich interview context.

        Args:
            interview_context: {
                "resume_text": str,
                "jd_text": str,
                "job_role": str,
                "questions": [{"index": int, "text": str, "type": str, "topic_label": str, "topic_source": str}],
                "answers": [{"index": int, "transcript": str, "answer_status": str | None}],
            }
        """
        questions = interview_context["questions"]
        answers = interview_context["answers"]
        resume_text = interview_context["resume_text"]
        jd_text = interview_context["jd_text"]
        job_role = interview_context["job_role"]

        qa_lines = []
        for q in questions:
            idx = q["index"]
            a = next((a for a in answers if a["index"] == idx), None)
            a_text = a["transcript"] if a and a["transcript"] else "(no answer captured)"
            a_status = a["answer_status"] if a else "unknown"
            qa_lines.append(
                f"Q{idx + 1} [{q['type']}] (topic: {q['topic_label']} / {q['topic_source']}):\n"
                f"  Question: {q['text']}\n"
                f"  Answer ({a_status}): {a_text}"
            )

        qa_block = "\n\n".join(qa_lines)

        messages = [
            {
                "role": "system",
                "content": (
                    "You are an expert interview evaluator. Analyze the completed interview "
                    "and provide a detailed structured evaluation.\n\n"

                    "INPUT: You receive the candidate's resume, the target job description, "
                    "and the full interview transcript with question types, topics, and answer statuses.\n\n"

                    "EVALUATION RULES:\n"
                    "- Evaluate ONLY what the candidate actually demonstrated.\n"
                    "- Do not assume skills not demonstrated or invent experience.\n"
                    "- Judge answers in context of the specific questions asked.\n"
                    "- Evaluate the interview as a whole for patterns.\n"
                    "- Penalize vague, incomplete, repetitive, or off-topic answers.\n"
                    "- Reward specific examples, clear reasoning, structured answers.\n"
                    "- Do not require every answer to contain a measurable metric.\n"
                    "- For recurring patterns: only report if visible in 2+ answers.\n"
                    "- For JD match: compare demonstrated skills against JD requirements.\n\n"

                    "OUTPUT SCHEMA (return ONLY valid JSON):\n"
                    "{\n"
                    '  "overall_score": int (0-100),\n'
                    '  "dimensions": {\n'
                    '    "technical_depth": int (0-100),\n'
                    '    "correctness": int (0-100),\n'
                    '    "specificity": int (0-100),\n'
                    '    "clarity": int (0-100),\n'
                    '    "communication": int (0-100)\n'
                    "  },\n"
                    '  "strengths": [str, str], (2-4 recurring strengths grounded in actual answers)\n'
                    '  "areas_to_improve": [str, str], (2-4 areas grounded in actual answers)\n'
                    '  "recurring_patterns": [str, str], (patterns visible across multiple answers — only if truly recurring)\n'
                    '  "question_feedback": [\n'
                    "    {\n"
                    '      "question_number": int (1-based),\n'
                    '      "score": int (0-100),\n'
                    '      "what_went_well": str,\n'
                    '      "what_was_missing": str,\n'
                    '      "how_to_improve": str\n'
                    "    }\n"
                    "  ],\n"
                    '  "recommendations": [str, str], (2-3 actionable, specific practice suggestions)\n'
                    '  "jd_match": {\n'
                    '    "strengths": [str, str], (where candidate meets JD requirements — with evidence)\n'
                    '    "gaps": [str, str] (where candidate lacks JD requirements — with evidence)\n'
                    "  }\n"
                    "}\n\n"

                    "DIMENSION GUIDELINES:\n"
                    "- technical_depth: Understanding of concepts, not just naming tools\n"
                    "- correctness: Accuracy of technical claims and approaches\n"
                    "- specificity: Concrete examples, metrics, details vs vague statements\n"
                    "- clarity: How well answers are structured and explained\n"
                    "- communication: Overall clarity, conciseness, and flow of responses\n\n"

                    "PER-QUESTION FEEDBACK:\n"
                    "- Reference the actual question and actual answer\n"
                    "- Be specific, not generic\n"
                    "- Score reflects how well that particular answer addressed the question\n\n"

                    "RECOMMENDATIONS:\n"
                    "- Must be concrete and practiceable\n"
                    "- Based on the actual recurring weaknesses identified\n"
                    "- Example: 'Practice explaining X by structuring answers as: problem → approach → trade-off → result'\n\n"

                    "JD MATCH:\n"
                    "- Compare what the candidate demonstrated against the JD requirements\n"
                    "- Cite specific evidence from their answers\n"
                    "- Do not simply repeat the JD text"
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Job Role: {job_role}\n\n"
                    f"=== CANDIDATE RESUME ===\n{resume_text}\n\n"
                    f"=== JOB DESCRIPTION ===\n{jd_text}\n\n"
                    f"=== INTERVIEW TRANSCRIPT ===\n\n{qa_block}"
                ),
            },
        ]

        raw = await self._chat(messages, max_tokens=4096)
        try:
            data = self._parse_json(raw)

            # Clamp scores
            data["overall_score"] = max(0, min(100, int(data.get("overall_score", 0))))
            if "dimensions" in data and isinstance(data["dimensions"], dict):
                data["dimensions"] = {
                    k: max(0, min(100, int(v)))
                    for k, v in data["dimensions"].items()
                }

            # Ensure required fields
            data.setdefault("dimensions", {})
            data.setdefault("strengths", [])
            data.setdefault("areas_to_improve", [])
            data.setdefault("recurring_patterns", [])
            data.setdefault("question_feedback", [])
            data.setdefault("recommendations", [])
            data.setdefault("jd_match", None)

            # Clamp per-question scores
            for qf in data.get("question_feedback", []):
                if isinstance(qf, dict):
                    qf["score"] = max(0, min(100, int(qf.get("score", 0))))

            return data
        except (ValueError, KeyError) as e:
            logger.warning("[LLM] generate_analysis parse failed: %s", e)
            return {
                "overall_score": 0,
                "dimensions": {},
                "strengths": [],
                "areas_to_improve": ["Analysis generation failed. Please retry."],
                "recurring_patterns": [],
                "question_feedback": [],
                "recommendations": [],
                "jd_match": None,
            }
