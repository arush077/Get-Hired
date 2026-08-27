import json
import logging
import os
import re

from dotenv import load_dotenv
from groq import Groq

load_dotenv()

logger = logging.getLogger(__name__)

GROQ_MODEL = "openai/gpt-oss-120b"
MAX_RETRIES = 3

CONCISENESS_INSTRUCTION = (
    "Ask ONE concise interview question (15-35 words). "
    "Focus on ONE concept. Do not combine multiple questions or requirements. "
    "Do not list topics to discuss — ask a single focused question. "
)

GROUNDING_RULES = (
    "CRITICAL RULES:\n"
    "- Use ONLY the Resume/JD context provided below.\n"
    "- NEVER invent candidate experience, projects, technologies, responsibilities, or achievements.\n"
    "- If the context mentions a specific project, role, company, or skill, ask about THAT specifically.\n"
    "- Use concrete names from the resume (project names, company names, tools, certifications).\n"
    "- If no relevant Resume/JD context is available, ask a general role-based question.\n"
    "- Every question must be traceable to the provided context.\n"
)

DOES_NOT_KNOW_PATTERNS = [
    "i don't know",
    "i'm not sure",
    "i have no idea",
    "i haven't worked on that",
    "i don't have experience",
    "i've never done that",
    "no experience",
    "not familiar with",
    "i haven't done that",
    "i haven't used that",
    "i haven't worked with that",
    "i don't think i have",
    "not really",
    "no i haven't",
    "never done that",
    "don't have that experience",
    "haven't really",
    "no major",
    "i have not",
    "i did not",
]

CLARIFICATION_PATTERNS = [
    "can you repeat",
    "could you explain",
    "what do you mean",
    "i didn't understand",
    "can you clarify",
    "could you rephrase",
    "what does that mean",
    "i'm not sure what you mean",
    "what do you mean by",
    "can you say that again",
    "could you elaborate",
    "i don't understand the question",
    "what exactly do you mean",
    "can you give an example",
    "what are you asking",
]


class LLMService:
    def __init__(self):
        self._client = Groq(api_key=os.getenv("GROQ_API_KEY"))

    def _chat(self, messages: list[dict], max_tokens: int = 512) -> str:
        response = self._client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content.strip()

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

    def _generate_with_retry(self, messages: list[dict], max_tokens: int = 512) -> str:
        for attempt in range(MAX_RETRIES):
            raw = self._chat(messages, max_tokens=max_tokens)
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

    def generate_hr_question(self, candidate_name: str, job_role: str, variant: str) -> str:
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
        return self._generate_with_retry(messages)

    def extract_resume_topics(
        self, resume_text: str, job_role: str, count: int = 10
    ) -> list[str]:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are an expert resume analyst. "
                    "Extract concrete, specific topics from this resume that can be used "
                    "as interview question subjects.\n\n"
                    "Extract the following categories when present:\n"
                    "- Project names and descriptions\n"
                    "- Specific skills and technologies\n"
                    "- Certifications or courses\n"
                    "- Company names and roles\n"
                    "- Education details\n"
                    "- Extracurricular activities, committees, leadership roles\n"
                    "- Specific achievements or responsibilities\n\n"
                    f"Return ONLY valid JSON: {{\"topics\": [\"topic1\", \"topic2\", ...]}}\n"
                    f"Extract exactly {count} topics. Be specific — use actual names from the resume, "
                    "not generic categories like 'skills' or 'projects'."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Job Role: {job_role}\n\n"
                    f"Resume:\n{resume_text}"
                ),
            },
        ]
        raw = self._chat(messages, max_tokens=512)
        try:
            data = self._parse_json(raw)
            topics = data.get("topics", [])
            if isinstance(topics, list) and len(topics) > 0:
                return [str(t) for t in topics[:count]]
        except (ValueError, KeyError):
            pass

        # Fallback: extract any quoted strings
        import re
        matches = re.findall(r'"([^"]{3,80})"', raw)
        if matches:
            return matches[:count]

        return [f"{job_role} experience", "technical skills", "projects"]

    def generate_primary_question(
        self,
        job_role: str,
        search_angle: str,
        context_chunks: list[str],
        topics_covered: list[str],
    ) -> str:
        chunks_text = "\n".join(f"- {c}" for c in context_chunks)
        covered_text = ", ".join(topics_covered) if topics_covered else "none yet"

        messages = [
            {
                "role": "system",
                "content": (
                    "You are an expert technical interviewer conducting a personalized interview. "
                    "Generate ONE interview question grounded in the candidate's actual resume/JD.\n\n"
                    + GROUNDING_RULES
                    + f"This question should explore: {search_angle}.\n"
                    f"Topics already covered: {covered_text}.\n"
                    "Do NOT repeat topics already covered.\n"
                    + CONCISENESS_INSTRUCTION
                    + 'Return ONLY valid JSON: {"question": "..."}'
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Job Role: {job_role}\n\n"
                    f"Relevant Resume/JD Context:\n{chunks_text}\n\n"
                    f"Generate a question about: {search_angle}\n"
                    "Use specific details from the context above. "
                    "Do NOT invent experience not mentioned in the context."
                ),
            },
        ]
        return self._generate_with_retry(messages)

    def generate_follow_up_question(
        self,
        job_role: str,
        previous_question: str,
        previous_answer: str,
        context_chunks: list[str],
    ) -> str:
        chunks_text = "\n".join(f"- {c}" for c in context_chunks)

        messages = [
            {
                "role": "system",
                "content": (
                    "You are an expert technical interviewer. "
                    "Generate ONE insightful follow-up question based on the candidate's previous answer.\n\n"
                    + GROUNDING_RULES
                    + "Dig deeper into their actual experience. Ask for specifics, examples, or details "
                    "mentioned in their answer or the Resume/JD context.\n"
                    + CONCISENESS_INSTRUCTION
                    + 'Return ONLY valid JSON: {"question": "..."}'
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Job Role: {job_role}\n\n"
                    f"Previous Question: {previous_question}\n"
                    f"Candidate's Answer: {previous_answer}\n\n"
                    f"Relevant Resume/JD Context:\n{chunks_text}\n\n"
                    "Generate a follow-up question grounded in the above context and answer."
                ),
            },
        ]
        return self._generate_with_retry(messages)

    def generate_deep_dive_question(
        self,
        job_role: str,
        topic: str,
        context_chunks: list[str],
        interview_history: list[dict],
    ) -> str:
        chunks_text = "\n".join(f"- {c}" for c in context_chunks)
        history_text = ""
        for i, qa in enumerate(interview_history):
            history_text += f"Q{i+1}: {qa['question']}\nA{i+1}: {qa['answer']}\n\n"

        messages = [
            {
                "role": "system",
                "content": (
                    "You are an expert technical interviewer. "
                    "Generate ONE deeper technical or design question on a specific topic.\n\n"
                    + GROUNDING_RULES
                    + f"Topic to explore in depth: {topic}.\n"
                    "This should be a challenging question that tests deep understanding — "
                    "architecture decisions, trade-offs, edge cases, or design patterns. "
                    "Ground the question in the candidate's actual projects or experience from the context.\n"
                    + CONCISENESS_INSTRUCTION
                    + 'Return ONLY valid JSON: {"question": "..."}'
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Job Role: {job_role}\n\n"
                    f"Relevant Resume/JD Context:\n{chunks_text}\n\n"
                    f"Interview so far:\n{history_text}\n"
                    f"Generate a deep-dive question about: {topic}\n"
                    "Use specific details from the Resume/JD context."
                ),
            },
        ]
        return self._generate_with_retry(messages)

    def generate_analysis(self, transcript: str) -> dict:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are an expert interview evaluator. "
                    "Analyze the completed interview below and provide a structured evaluation.\n\n"
                    "RULES:\n"
                    "- Evaluate ONLY what the candidate actually demonstrated in their answers.\n"
                    "- Do not assume skills not demonstrated.\n"
                    "- Do not invent candidate experience.\n"
                    "- Judge answers in the context of the questions asked.\n"
                    "- Evaluate the interview as a whole, not each answer independently.\n"
                    "- Look for consistency across answers.\n"
                    "- Penalize extremely vague, incomplete, repetitive, or off-topic answers.\n"
                    "- Reward specific examples, clear reasoning, structured answers, and relevant details.\n"
                    "- Do not require every answer to contain a measurable metric.\n"
                    "- Do not penalize lack of professional experience; evaluate the quality of examples provided.\n\n"
                    "SCORING FACTORS (use internally, do not expose separately):\n"
                    "- Relevance: Did the candidate answer what was asked?\n"
                    "- Clarity: Were answers understandable and structured?\n"
                    "- Specificity: Concrete details and examples?\n"
                    "- Depth: Reasoning vs shallow answers?\n"
                    "- Evidence: Claims supported by actual experience?\n"
                    "- Communication: Clear explanation of ideas?\n"
                    "- Consistency: Reasonably consistent across the interview?\n\n"
                    'Return ONLY valid JSON: {"overall_score": int, "strengths": [str, str], '
                    '"areas_to_improve": [str, str]}\n'
                    "- overall_score: integer 0-100\n"
                    "- strengths: 2-4 concise points\n"
                    "- areas_to_improve: 2-4 concise points\n"
                    "- Keep each point short (one sentence).\n"
                    "- Do not return markdown or explanations outside the JSON."
                ),
            },
            {
                "role": "user",
                "content": f"Interview Transcript:\n\n{transcript}",
            },
        ]
        raw = self._chat(messages, max_tokens=1024)
        return self._parse_json(raw)

    def classify_answer_rule_based(self, transcript: str) -> str | None:
        """Fast rule-based classification for obvious cases.

        Returns 'DOES_NOT_KNOW', 'NEEDS_CLARIFICATION', or None if not obvious.
        """
        lower = transcript.lower().strip()

        for pattern in CLARIFICATION_PATTERNS:
            if pattern in lower:
                return "NEEDS_CLARIFICATION"

        for pattern in DOES_NOT_KNOW_PATTERNS:
            if pattern in lower:
                return "DOES_NOT_KNOW"

        return None

    def classify_and_plan_next(
        self,
        job_role: str,
        current_question: str,
        candidate_answer: str,
        current_topic: str,
        questions_on_topic: int,
        recent_topics: list[str],
        topics_remaining: list[str],
        context_chunks: list[str],
        interview_history: list[dict],
    ) -> dict:
        """Classify the candidate's answer and decide the next action.

        Returns:
            {
                "answer_status": "ANSWERED" | "PARTIAL_ANSWER" | "DOES_NOT_KNOW" | "NEEDS_CLARIFICATION",
                "next_action": "FOLLOW_UP" | "NEW_TOPIC" | "CLARIFY",
                "reason": "...",
                "clarification": "..." (only when next_action=CLARIFY)
            }
        """
        chunks_text = "\n".join(f"- {c}" for c in context_chunks) if context_chunks else "No context available"
        covered_text = ", ".join(recent_topics) if recent_topics else "none yet"
        remaining_text = ", ".join(topics_remaining[:5]) if topics_remaining else "none remaining"
        history_text = ""
        for i, qa in enumerate(interview_history[-3:]):
            history_text += f"Q{i+1}: {qa['question']}\nA{i+1}: {qa['answer']}\n\n"

        messages = [
            {
                "role": "system",
                "content": (
                    "You are an expert interview analyst. Analyze the candidate's answer and decide what to do next.\n\n"
                    "STEP 1: Classify the answer status:\n"
                    "- ANSWERED: Candidate provided a meaningful answer with some substance\n"
                    "- PARTIAL_ANSWER: Candidate started answering but it's incomplete or lacks detail\n"
                    "- DOES_NOT_KNOW: Candidate explicitly says they don't know, have no experience, or haven't done this\n"
                    "- NEEDS_CLARIFICATION: Candidate is asking what the question means or asking for clarification\n\n"
                    "STEP 2: Decide the next action:\n"
                    "- CLARIFY: Candidate didn't understand the question. Rephrase the SAME question more clearly.\n"
                    "- FOLLOW_UP: Answer is incomplete or interesting — ask a deeper follow-up on the SAME topic.\n"
                    "- NEW_TOPIC: Answer is complete, topic is exhausted, or candidate doesn't know. Move to a DIFFERENT topic.\n\n"
                    "RULES:\n"
                    "- If answer_status is DOES_NOT_KNOW, next_action MUST be NEW_TOPIC.\n"
                    "- If answer_status is NEEDS_CLARIFICATION, next_action MUST be CLARIFY.\n"
                    "- If questions_on_topic >= 2, next_action MUST be NEW_TOPIC (hard cap).\n"
                    "- Prefer topic diversity. Don't stay on the same topic unless the follow-up is truly valuable.\n"
                    "- When choosing NEW_TOPIC, prefer resume-specific topics over generic ones.\n\n"
                    f"Current topic: {current_topic}\n"
                    f"Questions already asked on this topic: {questions_on_topic}\n"
                    f"Topics already discussed: {covered_text}\n"
                    f"Topics available: {remaining_text}\n\n"
                    'Return ONLY valid JSON: {"answer_status": "...", "next_action": "...", "reason": "...", "clarification": null}\n'
                    "- clarification should only be a string when next_action is CLARIFY, otherwise null.\n"
                    "- reason is for internal debugging only, keep it short (one sentence)."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Job Role: {job_role}\n\n"
                    f"Current Question: {current_question}\n"
                    f"Candidate Answer: {candidate_answer}\n\n"
                    f"Resume/JD Context:\n{chunks_text}\n\n"
                    f"Recent Interview History:\n{history_text}"
                ),
            },
        ]

        raw = self._chat(messages, max_tokens=512)
        try:
            data = self._parse_json(raw)
            answer_status = data.get("answer_status", "ANSWERED")
            next_action = data.get("next_action", "NEW_TOPIC")
            clarification = data.get("clarification")

            if answer_status not in ("ANSWERED", "PARTIAL_ANSWER", "DOES_NOT_KNOW", "NEEDS_CLARIFICATION"):
                answer_status = "ANSWERED"
            if next_action not in ("FOLLOW_UP", "NEW_TOPIC", "CLARIFY"):
                next_action = "NEW_TOPIC"

            return {
                "answer_status": answer_status,
                "next_action": next_action,
                "reason": data.get("reason", ""),
                "clarification": clarification if next_action == "CLARIFY" else None,
            }
        except (ValueError, KeyError) as e:
            logger.warning("[LLM] classify_and_plan_next parse failed: %s | raw: %r", e, raw[:200])
            return {
                "answer_status": "ANSWERED",
                "next_action": "NEW_TOPIC",
                "reason": f"Parse failed: {e}",
                "clarification": None,
            }
