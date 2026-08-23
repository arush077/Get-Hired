import { motion } from "framer-motion";

interface StatusBadgeProps {
  state: "idle" | "speaking" | "ready" | "listening" | "waiting" | "done" | "unsupported" | "error";
}

const labels: Record<string, string> = {
  idle: "Idle",
  speaking: "Speaking...",
  ready: "Ready to answer",
  listening: "Listening...",
  waiting: "Processing...",
  done: "Interview complete",
  unsupported: "Speech recognition not supported",
  error: "Microphone access denied",
};

const colors: Record<string, string> = {
  idle: "bg-neutral-500/10 text-neutral-400 border-neutral-500/20",
  speaking: "bg-amber-500/10 text-amber-400 border-amber-500/25",
  ready: "bg-green-500/10 text-green-400 border-green-500/25",
  listening: "bg-green-500/10 text-green-400 border-green-500/25",
  waiting: "bg-blue-500/10 text-blue-400 border-blue-500/25",
  done: "bg-blue-500/10 text-blue-400 border-blue-500/25",
  unsupported: "bg-red-500/10 text-red-400 border-red-500/25",
  error: "bg-red-500/10 text-red-400 border-red-500/25",
};

export function StatusBadge({ state }: StatusBadgeProps) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${colors[state] || colors.idle} ${
        state === "listening" ? "animate-pulse" : ""
      }`}
    >
      {labels[state] || state}
    </motion.span>
  );
}
