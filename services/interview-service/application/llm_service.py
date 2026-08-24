import json
import os
import re

from dotenv import load_dotenv
from groq import Groq

load_dotenv()

GROQ_MODEL = "openai/gpt-oss-120b"
MAX_RETRIES = 3

CONCISENESS_INSTRUCTION = (
    "Ask ONE concise interview question (15-35 words). "
    "Focus on ONE concept. Do not combine multiple questions or requirements. "
    "Do not list topics to discuss — ask a single focused question. "
)


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
        if len(text) > 300:
            return False
        word_count = len(text.split())
        if word_count < 5 or word_count > 50:
            return False
        return True

    def _generate_with_retry(self, messages: list[dict], max_tokens: int = 256) -> str:
        for attempt in range(MAX_RETRIES):
            raw = self._chat(messages, max_tokens=max_tokens)
            try:
                data = self._parse_json(raw)
                question = data.get("question", "")
                if self._validate_question(question):
                    return question
            except (ValueError, KeyError):
                pass

            if attempt == MAX_RETRIES - 1:
                match = re.search(r'"question"\s*:\s*"([^"]+)"', raw)
                if match and self._validate_question(match.group(1)):
                    return match.group(1)
                # Last resort: find any sentence-like string
                match = re.search(r"([A-Z][^.?!]{10,200}[.?!])", raw)
                if match and self._validate_question(match.group(1)):
                    return match.group(1)
                return "Can you tell me more about your experience?"
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
                    "Generate ONE fresh interview question based on the candidate's resume/JD context. "
                    f"This question should explore: {search_angle}. "
                    f"Topics already covered: {covered_text}. "
                    "Do NOT repeat topics already covered. "
                    + CONCISENESS_INSTRUCTION
                    + 'Return ONLY valid JSON: {"question": "..."}'
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Job Role: {job_role}\n\n"
                    f"Relevant Resume/JD Context:\n{chunks_text}\n\n"
                    f"Generate a fresh question about: {search_angle}"
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
                    "Generate ONE insightful follow-up question based on the candidate's previous answer. "
                    "Dig deeper into their experience, ask for specifics, or explore implications. "
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
                    "Generate a follow-up question."
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
                    "Generate ONE deeper technical or design question on a specific topic. "
                    f"Topic to explore in depth: {topic}. "
                    "This should be a challenging question that tests deep understanding — "
                    "architecture decisions, trade-offs, edge cases, or design patterns. "
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
                    f"Generate a deep-dive question about: {topic}"
                ),
            },
        ]
        return self._generate_with_retry(messages)
