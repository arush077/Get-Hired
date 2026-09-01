import { useState, useMemo, useEffect, useCallback } from "react";
import { API_BASE, getAuthHeaders } from "../../lib/api";
import { Spinner } from "../ui/spinner";
import type { ResumeData } from "../../hooks/useResume";

const CATEGORIES = [
  { key: "spelling_issues", label: "Spelling", icon: "✍️", priority: "high" },
  { key: "grammar_issues", label: "Grammar", icon: "📝", priority: "medium" },
  { key: "formatting_readability", label: "Formatting & Readability", icon: "📐", priority: "medium" },
  { key: "ats_compatibility", label: "ATS Compatibility", icon: "🤖", priority: "high" },
  { key: "content_improvements", label: "Content Quality", icon: "💼", priority: "high" },
  { key: "bullet_points", label: "Bullet Points", icon: "🎯", priority: "medium" },
  { key: "quantification", label: "Quantification", icon: "📊", priority: "medium" },
  { key: "technical_evaluation", label: "Technical Depth", icon: "⚙️", priority: "low" },
  { key: "consistency", label: "Consistency", icon: "🔄", priority: "low" },
  { key: "keywords", label: "Keywords", icon: "🔑", priority: "medium" },
];

const PRIORITY_CONFIG = {
  high: { label: "High Priority", color: "text-red-400", dot: "🔴" },
  medium: { label: "Medium Priority", color: "text-yellow-400", dot: "🟡" },
  low: { label: "Low Priority", color: "text-green-400", dot: "🟢" },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnalysisData = Record<string, any>;

interface AnalysisPanelProps {
  resume: ResumeData;
  analysis: AnalysisData | null;
  onAnalysis: (data: AnalysisData) => void;
  onClose: () => void;
}

export function ResumeAnalysisPanel({ resume, analysis, onAnalysis, onClose }: AnalysisPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown > 0]);

  const parseRetryAfter = useCallback((res: Response): number => {
    const header = res.headers.get("Retry-After");
    if (header) return parseInt(header, 10) || 60;
    return 60;
  }, []);

  function toggleGroup(priority: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(priority)) next.delete(priority);
      else next.add(priority);
      return next;
    });
  }

  async function handleAnalyze() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/resumes/ai/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(resume),
      });
      if (res.status === 429) {
        const retryAfter = parseRetryAfter(res);
        setCooldown(retryAfter);
        setError(`Rate limit reached. Try again in ${retryAfter}s.`);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || `Analysis failed (${res.status})`);
      }
      const data = await res.json();
      onAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const activeCategories = useMemo(() => {
    if (!analysis) return [];
    return CATEGORIES.filter((c) => analysis[c.key]?.length > 0);
  }, [analysis]);

  const totalIssues = useMemo(() => {
    if (!analysis) return 0;
    return activeCategories.reduce((sum, c) => sum + (analysis[c.key]?.length || 0), 0);
  }, [analysis, activeCategories]);

  const priorityGroups = useMemo(() => {
    if (!analysis) return [];
    const groups = [];
    for (const p of ["high", "medium", "low"]) {
      const cats = activeCategories.filter((c) => c.priority === p);
      if (cats.length === 0) continue;
      const count = cats.reduce((sum, c) => sum + (analysis[c.key]?.length || 0), 0);
      groups.push({
        ...PRIORITY_CONFIG[p as keyof typeof PRIORITY_CONFIG],
        priority: p,
        count,
        items: cats.flatMap((c) => {
          const entries = analysis[c.key] || [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return entries.map((e: any) => ({
            label: c.label,
            text: e.issue || e.text || "",
            suggestion: e.suggestion || "",
          }));
        }),
      });
    }
    return groups;
  }, [analysis, activeCategories]);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-md animate-slide-in">
        <div className="flex h-full flex-col bg-[#0c0c0c] border-l border-white/[0.06] shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-sm font-semibold font-heading text-gray-100">AI Resume Analysis</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-500 hover:text-white hover:bg-white/10 transition-all"
            >
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {!analysis && !loading && !error && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="mb-4 rounded-2xl bg-white/[0.03] p-4 border border-white/[0.06]">
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-10 w-10 text-[#d9c59a]">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-400 mb-1">Review your resume with AI</p>
                <p className="text-xs text-gray-600">Get detailed feedback across spelling, grammar, formatting, ATS, content, and more.</p>
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <Spinner size="lg" className="text-[#d9c59a]" />
                <p className="text-sm text-gray-400">Analyzing your resume...</p>
                <p className="text-xs text-gray-600">Reviewing across 10 quality dimensions</p>
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
                {error}
              </div>
            )}

            {analysis && (
              <div className="space-y-5">
                {/* Summary bar */}
                {totalIssues > 0 && (
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
                    <p className="text-sm font-medium text-gray-200">Found {totalIssues} issue{totalIssues !== 1 ? "s" : ""}</p>
                    {priorityGroups.map((g) => (
                      <div key={g.priority} className="space-y-1">
                        <p className={`text-xs font-semibold ${g.color}`}>
                          {g.dot} {g.label} ({g.count})
                        </p>
                        <ul className="space-y-0.5 pl-1">
                          {(expandedGroups.has(g.priority) ? g.items : g.items.slice(0, 3)).map((item, i) => (
                            <li key={i} className="text-xs text-gray-400 leading-relaxed flex gap-2">
                              <span className="text-gray-600 shrink-0">•</span>
                              <span><span className="text-gray-500">{item.label}:</span> {item.text}</span>
                            </li>
                          ))}
                          {g.items.length > 3 && (
                            <li>
                              <button
                                onClick={() => toggleGroup(g.priority)}
                                className="text-xs text-[#d9c59a]/70 hover:text-[#d9c59a] transition-colors pl-4"
                              >
                                {expandedGroups.has(g.priority) ? `show less` : `+${g.items.length - 3} more`}
                              </button>
                            </li>
                          )}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}

                {totalIssues === 0 && (
                  <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-4 text-sm text-green-400">
                    No issues found! Your resume looks great.
                  </div>
                )}

                {/* Recruiter Perspective */}
                {analysis.recruiter_perspective && (
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-white/[0.06]">
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-300">👀 Recruiter Perspective</span>
                    </div>
                    <div className="divide-y divide-white/[0.04]">
                      <Row label="First Impression" text={analysis.recruiter_perspective.first_impression} />
                      <Row label="Strengths" text={analysis.recruiter_perspective.strongest_aspects} />
                      <Row label="Weaknesses" text={analysis.recruiter_perspective.weakest_aspects} />
                      {analysis.recruiter_perspective.hesitation && (
                        <Row label="Red Flags" text={analysis.recruiter_perspective.hesitation} />
                      )}
                    </div>
                  </div>
                )}

                {/* Category cards */}
                {activeCategories.map((cat) => {
                  const items = analysis[cat.key] || [];
                  return (
                    <div key={cat.key} className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
                        <span className="text-xs font-semibold text-gray-200">
                          {cat.icon} {cat.label} • {items.length} issue{items.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="divide-y divide-white/[0.04]">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {items.map((item: any, i: number) => (
                          <div key={i} className="px-4 py-3 space-y-1.5">
                            <p className="text-xs text-gray-400 leading-relaxed">
                              <span className="text-gray-500 font-mono text-[10px] uppercase tracking-wider block mb-0.5">
                                {formatFieldPath(item.field || item.section)}
                              </span>
                              {item.text || item.issue}
                            </p>
                            <p className="text-xs text-gray-200 leading-relaxed pl-2 border-l-2 border-[#d9c59a]/40">
                              {item.suggestion}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer button */}
          <div className="border-t border-white/[0.06] px-5 py-4">
            <button
              onClick={handleAnalyze}
              disabled={loading || cooldown > 0}
              className="btn-gradient w-full rounded-xl py-2.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner size="sm" />
                  Analyzing...
                </span>
              ) : cooldown > 0 ? (
                <span className="flex items-center justify-center gap-2">
                  Available in {cooldown}s
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                  </svg>
                  {analysis ? "Re-analyze" : "Analyze Resume"}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function formatFieldPath(path: string) {
  if (!path) return "";
  const labels: Record<string, string> = {
    personalInfo: "Personal Info",
    personal_info: "Personal Info",
    education: "Education",
    experience: "Experience",
    projects: "Projects",
    skills: "Skills",
  };
  const root = path.split(".")[0];
  return labels[root] || root.charAt(0).toUpperCase() + root.slice(1);
}

function Row({ label, text }: { label: string; text: string | undefined }) {
  return (
    <div className="px-4 py-3 space-y-1">
      <span className="text-gray-500 text-[10px] font-mono uppercase tracking-wider block">{label}</span>
      <p className="text-xs text-gray-300 leading-relaxed">{text}</p>
    </div>
  );
}