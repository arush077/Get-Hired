import { useState } from "react";

interface SetupFormProps {
  onStart: (candidateName: string, jobRole: string) => void;
}

export function SetupForm({ onStart }: SetupFormProps) {
  const [candidateName, setCandidateName] = useState("");
  const [jobRole, setJobRole] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateName.trim() || !jobRole.trim()) return;
    onStart(candidateName.trim(), jobRole.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-xs font-bold uppercase tracking-[0.2em] text-neutral-400 mb-2">
          Candidate Name
        </label>
        <input
          type="text"
          value={candidateName}
          onChange={(e) => setCandidateName(e.target.value)}
          placeholder="e.g. John Doe"
          required
          className="w-full px-4 py-3 rounded-xl bg-neutral-900/80 border border-neutral-700 text-neutral-100 text-sm placeholder-neutral-600 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20 transition-all"
        />
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-[0.2em] text-neutral-400 mb-2">
          Job Role
        </label>
        <input
          type="text"
          value={jobRole}
          onChange={(e) => setJobRole(e.target.value)}
          placeholder="e.g. Software Engineer"
          required
          className="w-full px-4 py-3 rounded-xl bg-neutral-900/80 border border-neutral-700 text-neutral-100 text-sm placeholder-neutral-600 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20 transition-all"
        />
      </div>

      <button
        type="submit"
        disabled={!candidateName.trim() || !jobRole.trim()}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-red-600 text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.98] transition-all"
      >
        Start Interview
      </button>
    </form>
  );
}
