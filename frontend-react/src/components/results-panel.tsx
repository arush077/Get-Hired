import { motion } from "framer-motion";
import type { ResultItem } from "../lib/api";

interface ResultsPanelProps {
  results: ResultItem[];
  onRestart: () => void;
}

export function ResultsPanel({ results, onRestart }: ResultsPanelProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-neutral-50 border-b border-neutral-800 pb-4">
        Interview Results
      </h2>

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
