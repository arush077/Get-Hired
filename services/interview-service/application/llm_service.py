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

GROUNDING_RULES = (
    "CRITICAL RULES:\n"
    "- Use ONLY the Resume/JD context provided below.\n"
    "- NEVER invent candidate experience, projects, technologies, responsibilities, or achievements.\n"
    "- If the context mentions a specific project, role, company, or skill, ask about THAT specifically.\n"
    "- Use concrete names from the resume (project names, company names, tools, certifications).\n"
    "- If no relevant Resume/JD context is available, ask a general role-based question.\n"
    "- Every question must be traceable to the provided context.\n"
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
