export const API_BASE = import.meta.env.VITE_API_URL || "/api";
const TTS_BASE = import.meta.env.VITE_TTS_URL || (API_BASE.replace(/\/api\/?$/, "") + "/tts");

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
  next_action?: "FOLLOW_UP" | "NEW_TOPIC" | "CLARIFY";
  analysis?: Analysis;
}

export interface Analysis {
  overall_score: number;
  dimensions: Record<string, number>;
  strengths: string[];
  areas_to_improve: string[];
  recurring_patterns: string[];
  question_feedback: QuestionFeedback[];
  recommendations: string[];
  jd_match: JdMatch | null;
}

export interface QuestionFeedback {
  question_number: number;
  score: number;
  what_went_well: string;
  what_was_missing: string;
  how_to_improve: string;
}

export interface JdMatch {
  strengths: string[];
  gaps: string[];
}

export interface ResultItem {
  question_index: number;
  question: string;
  answer: string;
  question_type?: string;
  topic_label?: string;
  topic_source?: string;
  answer_status?: string;
}

export interface ResultsResponse {
  results: ResultItem[];
  analysis?: Analysis;
}

export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("ir_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchWithRetry(
  url: string,
  options?: RequestInit
): Promise<Response> {
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...options?.headers,
      },
    });

    if (RETRYABLE_STATUS.includes(res.status) && attempt < RETRY_DELAYS.length) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
      continue;
    }

    return res;
  }

  throw new Error("Service temporarily unavailable. Please try again.");
}

export async function startInterview(params: {
  candidateName: string;
  jobRole: string;
  jdText: string;
  resumeId?: string;
  resumeText?: string;
}): Promise<InterviewStartResponse> {
  const body: Record<string, string | number | undefined> = {
    candidate_name: params.candidateName,
    job_role: params.jobRole,
    jd_text: params.jdText,
    total_questions: 8,
  };

  if (params.resumeId) {
    body.resume_id = params.resumeId;
  } else if (params.resumeText) {
    body.resume_text = params.resumeText;
  }

  const res = await fetchWithRetry(`${API_BASE}/interviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
  speed: number,
  signal?: AbortSignal,
): Promise<Blob> {
  const res = await fetch(TTS_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice, speed }),
    signal,
  });
  if (!res.ok) throw new Error("TTS request failed");
  return res.blob();
}
