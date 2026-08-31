import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ResultItem, Analysis, QuestionFeedback } from "../lib/api";

interface ResultsPanelProps {
  results: ResultItem[];
  analysis: Analysis | null;
  onRestart: () => void;
}

const DIMENSION_LABELS: Record<string, string> = {
  technical_depth: "Technical Depth",
  correctness: "Correctness",
  specificity: "Specificity",
  clarity: "Clarity",
  communication: "Communication",
};

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color =
    score >= 75 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-neutral-400">{label}</span>
        <span className="text-neutral-300 font-mono">{score}</span>
      </div>
      <div className="h-1.5 rounded-full bg-neutral-700">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function QuestionCard({
  item,
  feedback,
}: {
  item: ResultItem;
  feedback?: QuestionFeedback;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: item.question_index * 0.05 }}
      className="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-900/40"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-4 flex items-start gap-3 hover:bg-neutral-800/30 transition-colors"
      >
        <span className="text-xs font-mono text-neutral-500 mt-0.5 shrink-0">
          Q{item.question_index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-neutral-100 leading-relaxed">
            {item.question}
          </p>
          <div className="flex gap-2 mt-1.5 flex-wrap">
            {item.question_type && (
              <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                {item.question_type}
              </span>
            )}
            {item.topic_label && (
              <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-400">
                {item.topic_label}
              </span>
            )}
            {feedback && (
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  feedback.score >= 75
                    ? "bg-green-500/10 text-green-400"
                    : feedback.score >= 50
                      ? "bg-yellow-500/10 text-yellow-400"
                      : "bg-red-500/10 text-red-400"
                }`}
              >
                {feedback.score}/100
              </span>
            )}
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-neutral-500 shrink-0 mt-1 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 space-y-4 border-t border-neutral-800">
              <div className="pt-3">
                <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1">
                  Your Answer
                </p>
                <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">
                  {item.answer || "(no answer captured)"}
                </p>
              </div>

              {feedback && (
                <div className="space-y-3 rounded-lg bg-neutral-800/40 p-3">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
                    Feedback
                  </p>
                  <FeedbackItem label="What went well" text={feedback.what_went_well} color="text-green-400" />
                  <FeedbackItem label="What was missing" text={feedback.what_was_missing} color="text-yellow-400" />
                  <FeedbackItem label="How to improve" text={feedback.how_to_improve} color="text-pink-400" />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function FeedbackItem({
  label,
  text,
  color,
}: {
  label: string;
  text: string;
  color: string;
}) {
  return (
    <div>
      <p className={`text-xs font-semibold ${color} mb-0.5`}>{label}</p>
      <p className="text-xs text-neutral-300 leading-relaxed">{text}</p>
    </div>
  );
}

export function ResultsPanel({ results, analysis, onRestart }: ResultsPanelProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "replay">("overview");

  const dimensions = analysis?.dimensions || {};
  const hasDimensions = Object.keys(dimensions).length > 0;
  const hasFeedback = (analysis?.question_feedback?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <h2 className="text-xl font-bold text-neutral-50">Interview Results</h2>
        <div className="flex gap-1 bg-neutral-800 rounded-lg p-0.5">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === "overview"
                ? "bg-neutral-700 text-neutral-100"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("replay")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === "replay"
                ? "bg-neutral-700 text-neutral-100"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Replay
          </button>
        </div>
      </div>

      {activeTab === "overview" && analysis && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Score + Dimensions */}
          <div className="rounded-2xl bg-neutral-800/50 border border-neutral-700 p-6 space-y-5">
            <div className="flex items-center gap-4">
              <div className="text-4xl font-bold text-pink-400">
                {analysis.overall_score}
                <span className="text-lg text-neutral-500 font-normal">/100</span>
              </div>
              <p className="text-sm text-neutral-400">Overall Score</p>
            </div>

            {hasDimensions && (
              <div className="space-y-2.5">
                {Object.entries(dimensions).map(([key, score]) => (
                  <ScoreBar
                    key={key}
                    label={DIMENSION_LABELS[key] || key}
                    score={score as number}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Strengths + Areas to Improve */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-neutral-800/50 border border-neutral-700 p-5">
              <h3 className="text-sm font-semibold text-green-400 mb-3">Strengths</h3>
              <ul className="space-y-2">
                {analysis.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-neutral-300 flex gap-2">
                    <span className="text-green-400 mt-0.5 shrink-0">&#10003;</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-neutral-800/50 border border-neutral-700 p-5">
              <h3 className="text-sm font-semibold text-rose-400 mb-3">Areas to Improve</h3>
              <ul className="space-y-2">
                {analysis.areas_to_improve.map((a, i) => (
                  <li key={i} className="text-sm text-neutral-300 flex gap-2">
                    <span className="text-rose-400 mt-0.5 shrink-0">&#9679;</span>
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Recurring Patterns */}
          {analysis.recurring_patterns.length > 0 && (
            <div className="rounded-2xl bg-neutral-800/50 border border-neutral-700 p-5">
              <h3 className="text-sm font-semibold text-yellow-400 mb-3">Recurring Patterns</h3>
              <ul className="space-y-2">
                {analysis.recurring_patterns.map((p, i) => (
                  <li key={i} className="text-sm text-neutral-300 flex gap-2">
                    <span className="text-yellow-400 mt-0.5 shrink-0">&#9888;</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* JD Match */}
          {analysis.jd_match && (
            <div className="rounded-2xl bg-neutral-800/50 border border-neutral-700 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-pink-400">JD Match</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {analysis.jd_match.strengths.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-green-400 mb-2">Met Requirements</p>
                    <ul className="space-y-1.5">
                      {analysis.jd_match.strengths.map((s, i) => (
                        <li key={i} className="text-xs text-neutral-300 flex gap-2">
                          <span className="text-green-400 mt-0.5 shrink-0">&#10003;</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.jd_match.gaps.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-rose-400 mb-2">Gaps</p>
                    <ul className="space-y-1.5">
                      {analysis.jd_match.gaps.map((g, i) => (
                        <li key={i} className="text-xs text-neutral-300 flex gap-2">
                          <span className="text-rose-400 mt-0.5 shrink-0">&#9679;</span>
                          {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {analysis.recommendations.length > 0 && (
            <div className="rounded-2xl bg-neutral-800/50 border border-neutral-700 p-5">
              <h3 className="text-sm font-semibold text-blue-400 mb-3">Recommendations</h3>
              <ul className="space-y-2">
                {analysis.recommendations.map((r, i) => (
                  <li key={i} className="text-sm text-neutral-300 flex gap-2">
                    <span className="text-blue-400 mt-0.5 shrink-0 font-mono text-xs">{i + 1}.</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </motion.div>
      )}

      {activeTab === "overview" && !analysis && (
        <div className="text-center py-12 text-neutral-500 text-sm">
          No analysis available for this interview.
        </div>
      )}

      {activeTab === "replay" && (
        <div className="space-y-3">
          {results.map((item) => {
            const feedback = hasFeedback
              ? analysis!.question_feedback.find(
                  (f) => f.question_number === item.question_index + 1
                )
              : undefined;
            return (
              <QuestionCard
                key={item.question_index}
                item={item}
                feedback={feedback}
              />
            );
          })}
        </div>
      )}

      <button
        onClick={onRestart}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-red-600 text-white font-semibold text-sm hover:brightness-110 active:scale-[0.98] transition-all"
      >
        Start New Interview
      </button>
    </div>
  );
}
