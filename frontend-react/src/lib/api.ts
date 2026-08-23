const API_BASE = "/api";
const TTS_BASE = "/tts";

export interface InterviewStartResponse {
  interview_id: string;
  question: string;
  question_index: number;
  total_questions: number;
}

export interface AnswerResponse {
  next_question?: string;
  next_question_index?: number;
}

export interface ResultItem {
  question_index: number;
  question: string;
  answer: string;
}

export interface ResultsResponse {
  results: ResultItem[];
}

export async function startInterview(
  candidateName: string,
  jobRole: string
): Promise<InterviewStartResponse> {
  const res = await fetch(`${API_BASE}/interviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidate_name: candidateName, job_role: jobRole }),
  });
  if (!res.ok) throw new Error("Failed to start interview");
  return res.json();
}

export async function submitAnswer(
  interviewId: string,
  transcript: string
): Promise<AnswerResponse> {
  const res = await fetch(`${API_BASE}/interviews/${interviewId}/answers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript }),
  });
  if (!res.ok) throw new Error("Failed to submit answer");
  return res.json();
}

export async function getResults(
  interviewId: string
): Promise<ResultsResponse> {
  const res = await fetch(`${API_BASE}/interviews/${interviewId}/results`);
  if (!res.ok) throw new Error("Failed to get results");
  return res.json();
}

export async function fetchTTS(
  text: string,
  voice: string,
  speed: number
): Promise<Blob> {
  const res = await fetch(TTS_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice, speed }),
  });
  if (!res.ok) throw new Error("TTS request failed");
  return res.blob();
}
