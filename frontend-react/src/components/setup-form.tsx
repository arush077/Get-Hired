import { useState } from "react";

const VOICES = [
  { value: "en-US-AvaNeural", label: "Ava (US, Female)" },
  { value: "en-US-AndrewNeural", label: "Andrew (US, Male)" },
  { value: "en-US-EmmaNeural", label: "Emma (US, Female)" },
  { value: "en-US-BrianNeural", label: "Brian (US, Male)" },
  { value: "en-GB-SoniaNeural", label: "Sonia (UK, Female)" },
  { value: "en-GB-RyanNeural", label: "Ryan (UK, Male)" },
  { value: "en-AU-NatashaNeural", label: "Natasha (AU, Female)" },
  { value: "en-IN-PrabhatNeural", label: "Prabhat (IN, Male)" },
  { value: "en-IE-EmilyNeural", label: "Emily (IE, Female)" },
];

interface SetupFormProps {
  onStart: (candidateName: string, jobRole: string, voice: string, speed: number) => Promise<void>;
}

export function SetupForm({ onStart }: SetupFormProps) {
  const [candidateName, setCandidateName] = useState("");
  const [jobRole, setJobRole] = useState("");
  const [voice, setVoice] = useState(VOICES[0].value);
  const [speed, setSpeed] = useState(1.0);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateName.trim() || !jobRole.trim()) return;
    setLoading(true);
    try {
      await onStart(candidateName.trim(), jobRole.trim(), voice, speed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-xs font-bold uppercase tracking-[0.2em] text-neutral-400 mb-2">
          Voice
        </label>
        <select
          value={voice}
          onChange={(e) => setVoice(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-neutral-900/80 border border-neutral-700 text-neutral-100 text-sm font-mono focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20 transition-all"
        >
          {VOICES.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-[0.2em] text-neutral-400 mb-2">
          Speed: {speed.toFixed(1)}x
        </label>
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.1"
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none bg-neutral-700 cursor-pointer accent-pink-500"
        />
      </div>

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
        disabled={loading || !candidateName.trim() || !jobRole.trim()}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-red-600 text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.98] transition-all"
      >
        {loading ? "Starting..." : "Start Interview"}
      </button>
    </form>
  );
}
