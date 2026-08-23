import { StatusBadge } from "./status-badge";

interface InterviewPanelProps {
  state: "idle" | "speaking" | "ready" | "listening" | "waiting" | "done" | "unsupported" | "error";
  question: string;
  questionIndex: number;
  totalQuestions: number;
  transcript: string;
  onStartAnswer: () => void;
  onFinishAnswer: () => void;
}

export function InterviewPanel({
  state,
  question,
  questionIndex,
  totalQuestions,
  transcript,
  onStartAnswer,
  onFinishAnswer,
}: InterviewPanelProps) {
  const showStartBtn = state === "ready";
  const showFinishBtn = state === "listening";

  return (
    <div className="space-y-6">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">
        Question {questionIndex + 1} of {totalQuestions}
      </p>

      <p className="text-xl font-medium text-white leading-relaxed">
        {question}
      </p>

      <StatusBadge state={state} />

      {state === "listening" && transcript && (
        <div className="min-h-[120px] p-4 rounded-xl bg-black/20 border border-white/10 font-mono text-sm text-white/90 leading-relaxed whitespace-pre-wrap">
          {transcript}
        </div>
      )}

      <div className="flex flex-col gap-3 pt-8">
        {showStartBtn && (
          <button
            onClick={onStartAnswer}
            className="w-full px-6 py-3 rounded-xl bg-white text-neutral-950 font-semibold text-sm hover:bg-neutral-100 active:scale-[0.98] transition-all"
          >
            Start Answering
          </button>
        )}
        {showFinishBtn && (
          <button
            onClick={onFinishAnswer}
            className="w-full px-6 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-semibold text-sm hover:bg-white/20 active:scale-[0.98] transition-all"
          >
            Finish Answer
          </button>
        )}
      </div>
    </div>
  );
}
