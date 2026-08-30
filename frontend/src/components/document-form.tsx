import { useState, useEffect } from "react";
import { API_BASE, getAuthHeaders } from "../lib/api";
import { Spinner } from "./ui/spinner";
import type { ResumeListItem } from "../hooks/useResume";

const MAX_CHARS = 15000;

interface DocumentFormProps {
  onSubmit: (jobRole: string, resumeText: string, jdText: string, resumeId?: string) => Promise<void>;
}

export function DocumentForm({ onSubmit }: DocumentFormProps) {
  const [jobRole, setJobRole] = useState("");
  const [mode, setMode] = useState<"select" | "paste">("select");
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>("");
  const [resumeText, setResumeText] = useState("");
  const [jdText, setJdText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadResumes() {
      try {
        const res = await fetch(`${API_BASE}/resumes`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setResumes(data.resumes || []);
          if (data.resumes?.length > 0) {
            setMode("select");
          } else {
            setMode("paste");
          }
        }
      } catch {
        setMode("paste");
      }
    }
    loadResumes();
  }, []);

  const jdCount = jdText.length;
  const isValid = jobRole.trim().length > 0 && (
    mode === "select"
      ? selectedResumeId !== "" && jdText.trim().length > 0
      : resumeText.trim().length > 0 && jdText.trim().length > 0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || loading) return;

    setLoading(true);
    setError(null);
    try {
      if (mode === "select") {
        await onSubmit(jobRole, "", jdText, selectedResumeId);
      } else {
        await onSubmit(jobRole, resumeText, jdText);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-xs font-bold uppercase tracking-[0.2em] text-neutral-400 mb-2">
          Job Role
        </label>
        <input
          type="text"
          value={jobRole}
          onChange={(e) => setJobRole(e.target.value)}
          placeholder="e.g. Senior Software Engineer"
          required
          className="w-full px-4 py-3 rounded-xl bg-neutral-900/80 border border-neutral-700 text-neutral-100 text-sm placeholder-neutral-600 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20 transition-all"
        />
      </div>

      {/* Resume source selection */}
      {resumes.length > 0 && (
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setMode("select")}
            className={`flex-1 py-2.5 text-sm font-medium rounded-xl border transition-all ${
              mode === "select"
                ? "bg-pink-500/10 border-pink-500/30 text-pink-400"
                : "bg-neutral-900/50 border-neutral-700 text-neutral-400 hover:border-neutral-600"
            }`}
          >
            My Saved Resume
          </button>
          <button
            type="button"
            onClick={() => setMode("paste")}
            className={`flex-1 py-2.5 text-sm font-medium rounded-xl border transition-all ${
              mode === "paste"
                ? "bg-pink-500/10 border-pink-500/30 text-pink-400"
                : "bg-neutral-900/50 border-neutral-700 text-neutral-400 hover:border-neutral-600"
            }`}
          >
            Paste Resume
          </button>
        </div>
      )}

      {/* Resume source */}
      {mode === "select" && resumes.length > 0 && (
        <div>
          <label className="block text-xs font-bold uppercase tracking-[0.2em] text-neutral-400 mb-2">
            Select Resume
          </label>
          <div className="space-y-2">
            {resumes.map((r) => (
              <label
                key={r.id}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedResumeId === r.id
                    ? "bg-pink-500/10 border-pink-500/30"
                    : "bg-neutral-900/50 border-neutral-700 hover:border-neutral-600"
                }`}
              >
                <input
                  type="radio"
                  name="resume"
                  value={r.id}
                  checked={selectedResumeId === r.id}
                  onChange={() => setSelectedResumeId(r.id)}
                  className="accent-pink-500"
                />
                <span className="text-sm text-neutral-200">{r.title}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {mode === "paste" && (
        <div>
          <label className="block text-xs font-bold uppercase tracking-[0.2em] text-neutral-400 mb-2">
            Resume
          </label>
          <textarea
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value.slice(0, MAX_CHARS))}
            placeholder="Paste your resume here..."
            rows={6}
            required
            className="w-full px-4 py-3 rounded-xl bg-neutral-900/80 border border-neutral-700 text-neutral-100 text-sm placeholder-neutral-600 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20 transition-all resize-none font-mono"
          />
          <p className="text-xs mt-1 text-right text-neutral-500">
            {resumeText.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
          </p>
        </div>
      )}

      <div>
        <label className="block text-xs font-bold uppercase tracking-[0.2em] text-neutral-400 mb-2">
          Job Description
        </label>
        <textarea
          value={jdText}
          onChange={(e) => setJdText(e.target.value.slice(0, MAX_CHARS))}
          placeholder="Paste the job description here..."
          rows={6}
          required
          className="w-full px-4 py-3 rounded-xl bg-neutral-900/80 border border-neutral-700 text-neutral-100 text-sm placeholder-neutral-600 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20 transition-all resize-none font-mono"
        />
        <p className={`text-xs mt-1 text-right ${jdCount > MAX_CHARS * 0.9 ? "text-rose-400" : "text-neutral-500"}`}>
          {jdCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!isValid || loading}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-red-600 text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.98] transition-all"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Spinner size="sm" />
            Starting interview...
          </span>
        ) : (
          "Start Interview"
        )}
      </button>
    </form>
  );
}
