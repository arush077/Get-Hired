import { motion, AnimatePresence } from "framer-motion";
import { StatusBadge } from "./status-badge";

export function InterviewPanel({
  state,
  question,
  questionIndex,
  totalQuestions,
  transcript,
  error,
  onStartAnswer,
  onFinishAnswer,
}) {
  const showStartBtn = state === "ready";
  const showFinishBtn = state === "listening";
  const isSpeaking = state === "speaking";
  const isProcessing = state === "waiting";

  return (
    <div className="space-y-6">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">
        Question {questionIndex + 1} of {totalQuestions}
      </p>

      <motion.p
        key={question}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={`text-xl font-medium leading-relaxed transition-colors duration-300 ${
          isSpeaking ? "text-white" : "text-white/90"
        }`}
      >
        {question}
      </motion.p>

      <div className="flex items-center gap-3">
        <StatusBadge state={state} />
      </div>

      {state === "listening" && transcript && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="min-h-[120px] p-4 rounded-xl bg-black/20 border border-white/10 font-mono text-sm text-white/90 leading-relaxed whitespace-pre-wrap"
        >
          {transcript}
        </motion.div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <AnimatePresence mode="wait">
          {showStartBtn && (
            <motion.button
              key="start"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onStartAnswer}
              className="w-full px-6 py-3 rounded-xl bg-white text-neutral-950 font-semibold text-sm hover:bg-neutral-100 transition-colors"
            >
              Start Answering
            </motion.button>
          )}
          {showFinishBtn && (
            <motion.button
              key="finish"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onFinishAnswer}
              className="w-full px-6 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-semibold text-sm hover:bg-white/20 transition-colors"
            >
              Finish Answer
            </motion.button>
          )}
          {isProcessing && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full px-6 py-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center gap-3"
            >
              <motion.div
                className="w-4 h-4 border-2 border-white/20 border-t-white/80 rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
              />
              <span className="text-white/60 text-sm font-medium">Processing your answer...</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
