import { useState } from "react";

const MAX_CHARS = 15000;

interface DocumentFormProps {
  onSubmit: (resumeText: string, jdText: string) => Promise<void>;
}

export function DocumentForm({ onSubmit }: DocumentFormProps) {
  const [resumeText, setResumeText] = useState("");
  const [jdText, setJdText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resumeCount = resumeText.length;
  const jdCount = jdText.length;
  const isValid = resumeText.trim().length > 0 && jdText.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || loading) return;

    setLoading(true);
    setError(null);
    try {
      await onSubmit(resumeText, jdText);
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
        <p className={`text-xs mt-1 text-right ${resumeCount > MAX_CHARS * 0.9 ? "text-amber-400" : "text-neutral-500"}`}>
          {resumeCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
        </p>
      </div>

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
        <p className={`text-xs mt-1 text-right ${jdCount > MAX_CHARS * 0.9 ? "text-amber-400" : "text-neutral-500"}`}>
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
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Starting interview...
          </span>
        ) : (
          "Start Interview"
        )}
      </button>
    </form>
  );
}
