import { motion } from "framer-motion";

const labels = {
  idle: "Idle",
  speaking: "Speaking...",
  ready: "Ready to answer",
  listening: "Listening...",
  waiting: "",
  done: "Interview complete",
  unsupported: "Speech recognition not supported",
  error: "Microphone access denied",
};

const colors = {
  idle: "bg-neutral-500/10 text-neutral-400 border-neutral-500/20",
  speaking: "bg-rose-500/10 text-rose-400 border-rose-500/25",
  ready: "bg-green-500/10 text-green-400 border-green-500/25",
  listening: "bg-green-500/10 text-green-400 border-green-500/25",
  waiting: "bg-blue-500/10 text-blue-400 border-blue-500/25",
  done: "bg-blue-500/10 text-blue-400 border-blue-500/25",
  unsupported: "bg-red-500/10 text-red-400 border-red-500/25",
  error: "bg-red-500/10 text-red-400 border-red-500/25",
};

function SpeakingDots() {
  return (
    <span className="inline-flex gap-0.5 ml-1.5 items-center">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1 h-1 rounded-full bg-rose-400"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.2,
            ease: "easeInOut",
          }}
        />
      ))}
    </span>
  );
}

function ProcessingSpinner() {
  return (
    <span className="inline-flex items-center gap-1.5 ml-1.5">
      <motion.span
        className="w-3.5 h-3.5 border-2 border-blue-400/30 border-t-blue-400 rounded-full"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      />
    </span>
  );
}

function ListeningWaves() {
  return (
    <span className="inline-flex items-center gap-[2px] ml-1.5 h-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.span
          key={i}
          className="w-[2px] rounded-full bg-green-400"
          animate={{
            height: ["4px", "12px", "4px"],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.1,
            ease: "easeInOut",
          }}
        />
      ))}
    </span>
  );
}

export function StatusBadge({ state }) {
  if (state === "waiting") return null;

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${
        colors[state] || colors.idle
      }`}
    >
      {labels[state] || state}
      {state === "speaking" && <SpeakingDots />}
      {state === "listening" && <ListeningWaves />}
    </motion.span>
  );
}
