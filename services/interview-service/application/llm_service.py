import json
import os

from dotenv import load_dotenv
from groq import Groq

load_dotenv()

GROQ_MODEL = "openai/gpt-oss-120b"


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
        # Strip markdown fences if present
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1])
        return json.loads(text)

    def generate_first_question(self, job_role: str, resume_summary: str) -> str:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are an expert technical interviewer. "
                    "Generate ONE thoughtful opening interview question based on the candidate's role and resume. "
                    "Return ONLY valid JSON: {\"question\": \"...\"}"
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Job Role: {job_role}\n"
                    f"Resume Summary: {resume_summary}\n\n"
                    "Generate the first interview question."
                ),
            },
        ]
        raw = self._chat(messages, max_tokens=256)
        data = self._parse_json(raw)
        return data["question"]

    def generate_cross_question(
        self,
        job_role: str,
        previous_qa: list[dict],
        current_answer: str,
        context_chunks: list[str],
    ) -> str:
        prev_qa_text = ""
        for i, qa in enumerate(previous_qa):
            prev_qa_text += f"Q{i+1}: {qa['question']}\nA{i+1}: {qa['answer']}\n\n"

        chunks_text = "\n".join(f"- {c}" for c in context_chunks)

        messages = [
            {
                "role": "system",
                "content": (
                    "You are an expert technical interviewer conducting a personalized interview. "
                    "Based on the candidate's resume context, job description, previous Q&A, "
                    "and their latest answer, generate ONE insightful follow-up question. "
                    "The question should dig deeper into their experience. "
                    "Return ONLY valid JSON: {\"question\": \"...\"}"
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Job Role: {job_role}\n\n"
                    f"Relevant Resume/JD Context:\n{chunks_text}\n\n"
                    f"Previous Q&A:\n{prev_qa_text}\n"
                    f"Candidate's Latest Answer: {current_answer}\n\n"
                    "Generate a personalized follow-up question."
                ),
            },
        ]
        raw = self._chat(messages, max_tokens=256)
        data = self._parse_json(raw)
        return data["question"]
