import { Header } from "../components/header";
import { SetupForm } from "../components/setup-form";
import { InterviewPanel } from "../components/interview-panel";
import { ResultsPanel } from "../components/results-panel";
import { AnimatedLines } from "../components/animated-lines";
import { useInterview } from "../hooks/useInterview";
import { motion, AnimatePresence } from "framer-motion";

export function Interview() {
  const {
    state,
    question,
    questionIndex,
    totalQuestions,
    results,
    transcript,
    start,
    startAnswer,
    finishAnswer,
    restart,
  } = useInterview();

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <Header />
      <main className="pt-24 px-4 pb-16 flex justify-center">
        <div className="w-full max-w-4xl">
          <AnimatePresence mode="wait">
            {state === "setup" && (
              <motion.div
                key="setup"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="rounded-3xl bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 p-8"
              >
                <h1 className="text-2xl font-bold text-neutral-50 mb-6">
                  Start Interview
                </h1>
                <SetupForm onStart={start} />
              </motion.div>
            )}

            {(state === "speaking" || state === "ready" || state === "listening" || state === "waiting") && (
              <motion.div
                key="interview"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-pink-500 via-red-600 to-red-700"
              >
                <div className="relative z-10 p-8 sm:p-12">
                  <InterviewPanel
                    state={state}
                    question={question}
                    questionIndex={questionIndex}
                    totalQuestions={totalQuestions}
                    transcript={transcript}
                    onStartAnswer={startAnswer}
                    onFinishAnswer={finishAnswer}
                  />
                </div>
                <div className="relative h-32 overflow-hidden">
                  <AnimatedLines speed={0.7} />
                </div>
              </motion.div>
            )}

            {state === "results" && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="rounded-3xl bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 p-8"
              >
                <ResultsPanel results={results} onRestart={restart} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
