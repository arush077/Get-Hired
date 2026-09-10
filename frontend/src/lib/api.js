export const API_BASE = import.meta.env.VITE_API_URL || "/api";

const RETRY_DELAYS = [5000, 15000];
const RETRYABLE_STATUS = [429, 502, 503, 504];

export const INTERVIEW_MODES = [
  { value: "MIXED", label: "Mixed Interview", description: "Balanced mix of resume, technical, and HR questions" },
  { value: "RESUME_DEEP_DIVE", label: "Resume Deep Dive", description: "Deep technical exploration of projects and experience" },
  { value: "TECHNICAL", label: "Technical", description: "Probe technical skills from your resume and the job description" },
  { value: "HR_SCREENING", label: "HR Screening", description: "Recruiter-style conversation about motivation and fit" },
];

export function getAuthHeaders() {
  const token = localStorage.getItem("ir_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchWithRetry(
  url,
  options
) {
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

export async function startInterview(params) {
  const body = {
    candidate_name: params.candidateName,
    job_role: params.jobRole,
    jd_text: params.jdText,
    total_questions: 8,
    interview_mode: params.interviewMode || "MIXED",
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
  interviewId,
  transcript
) {
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
  interviewId
) {
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

export async function importResume(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/resumes/import`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail || "Import failed");
  }
  return res.json();
}
