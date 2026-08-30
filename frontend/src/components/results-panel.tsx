import { motion } from "framer-motion";
import type { ResultItem, Analysis } from "../lib/api";

interface ResultsPanelProps {
  results: ResultItem[];
  analysis: Analysis | null;
  onRestart: () => void;
}

export function ResultsPanel({ results, analysis, onRestart }: ResultsPanelProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-neutral-50 border-b border-neutral-800 pb-4">
        Interview Results
      </h2>

      {analysis && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-neutral-800/50 border border-neutral-700 p-6 space-y-5"
        >
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold text-pink-400">
              {analysis.overall_score}
              <span className="text-lg text-neutral-500 font-normal">/100</span>
            </div>
            <p className="text-sm text-neutral-400">Interview Score</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-semibold text-green-400 mb-2">Strengths</h3>
              <ul className="space-y-1.5">
                {analysis.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-neutral-300 flex gap-2">
                    <span className="text-green-400 mt-0.5">&#10003;</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-rose-400 mb-2">Areas to Improve</h3>
              <ul className="space-y-1.5">
                {analysis.areas_to_improve.map((a, i) => (
                  <li key={i} className="text-sm text-neutral-300 flex gap-2">
                    <span className="text-rose-400 mt-0.5">&#9679;</span>
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      )}

      <div className="space-y-4">
        {results.map((item) => (
          <motion.div
            key={item.question_index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: item.question_index * 0.1 }}
            className="border-l-2 border-pink-500 pl-4 py-3 rounded-r-xl bg-neutral-900/40"
          >
            <p className="text-sm font-semibold text-neutral-100 mb-2">
              Q{item.question_index + 1}: {item.question}
            </p>
            <p className="text-sm text-neutral-400 leading-relaxed whitespace-pre-wrap">
              {item.answer || "(no answer captured)"}
            </p>
          </motion.div>
        ))}
      </div>

      <button
        onClick={onRestart}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-red-600 text-white font-semibold text-sm hover:brightness-110 active:scale-[0.98] transition-all"
      >
        Start New Interview
      </button>
    </div>
  );
}
