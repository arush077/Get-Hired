const API_BASE = import.meta.env.VITE_API_URL || "/api";
const TTS_BASE = import.meta.env.VITE_TTS_URL || "/tts";

const RETRY_DELAYS = [3000];
const RETRYABLE_STATUS = [502, 503, 504];

export interface InterviewStartResponse {
  interview_id: string;
  question: string;
  question_index: number;
  total_questions: number;
}

export interface AnswerResponse {
  next_question?: string;
  next_question_index?: number;
  total_questions?: number;
  is_clarification?: boolean;
  analysis?: Analysis;
}

export interface Analysis {
  overall_score: number;
  strengths: string[];
  areas_to_improve: string[];
}

export interface ResultItem {
  question_index: number;
  question: string;
  answer: string;
}

export interface ResultsResponse {
  results: ResultItem[];
  analysis?: Analysis;
}

async function fetchWithRetry(
  url: string,
  options?: RequestInit
): Promise<Response> {
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    const res = await fetch(url, options);

    if (RETRYABLE_STATUS.includes(res.status) && attempt < RETRY_DELAYS.length) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
      continue;
    }

    return res;
  }

  throw new Error("Service temporarily unavailable. Please try again.");
}

export async function startInterview(
  candidateName: string,
  jobRole: string,
  resumeText: string,
  jdText: string
): Promise<InterviewStartResponse> {
  const res = await fetchWithRetry(`${API_BASE}/interviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      candidate_name: candidateName,
      job_role: jobRole,
      resume_text: resumeText,
      jd_text: jdText,
      total_questions: 10,
    }),
  });
  if (!res.ok) {
    let detail = "Failed to start interview";
    try {
      const body = await res.json();
      if (body.detail) detail = body.detail;
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export async function submitAnswer(
  interviewId: string,
  transcript: string
): Promise<AnswerResponse> {
  const res = await fetchWithRetry(`${API_BASE}/interviews/${interviewId}/answers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript }),
  });
  if (!res.ok) {
    let detail = "Failed to submit answer";
    try {
      const body = await res.json();
      if (body.detail) detail = body.detail;
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export async function getResults(
  interviewId: string
): Promise<ResultsResponse> {
  const res = await fetchWithRetry(`${API_BASE}/interviews/${interviewId}/results`);
  if (!res.ok) {
    let detail = "Failed to get results";
    try {
      const body = await res.json();
      if (body.detail) detail = body.detail;
    } catch {}
    throw new Error(detail);
  }
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
