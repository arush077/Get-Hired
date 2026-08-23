"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatedLines } from "./animated-lines";

const stats = [
  { value: 100, suffix: "%", label: "Uptime" },
  { value: 3, suffix: "x", label: "Faster Insights" },
  { value: 92, suffix: "%", label: "Less Manual Work" },
  { value: 40, suffix: "+", label: "Integrations" },
];

function AnimatedNumber({ value, suffix }: { value: number; suffix: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const duration = 1500;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(tick);
    }

    const raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <span>
      {display}
      {suffix}
    </span>
  );
}

export function Hero() {
  return (
    <section className="relative px-4 pt-28 pb-0 sm:px-6 md:pt-32">
      <div className="relative mx-auto w-full max-w-7xl overflow-hidden rounded-3xl bg-gradient-to-b from-pink-500 via-red-600 to-red-700 px-6 py-20 sm:px-10 md:py-20">
        <AnimatedLines />

        <div className="relative z-10 flex flex-col items-center text-center">
          <motion.h1
            className="max-w-xl lg:max-w-2xl text-4xl font-medium leading-10 md:leading-14 lg:leading-18 tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            Ace your next interview with AI
          </motion.h1>

          <motion.p
            className="mt-5 max-w-xl text-base text-neutral-200 sm:text-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2, ease: "easeOut" }}
          >
            InterviewReady helps you practice with AI-powered voice interviews,
            real-time feedback, and detailed performance analytics.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.05 }}
            transition={{
              opacity: { duration: 0.3, delay: 0.3, ease: "easeOut" },
              y: { duration: 0.3, delay: 0.3, ease: "easeOut" },
              scale: { duration: 0.2, delay: 0, ease: "easeOut" },
            }}
          >
            <Link
              to="/interview"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-neutral-50 px-6 py-3 text-sm font-semibold text-neutral-950"
            >
              Start Interview
              <span className="flex size-6 items-center justify-center rounded-full bg-neutral-950 text-neutral-50">
                <ArrowUpRight className="size-3.5" />
              </span>
            </Link>
          </motion.div>
        </div>

        <motion.div
          className="relative z-10 mt-16 grid grid-cols-2 gap-6 sm:mt-20 md:grid-cols-4"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl font-bold text-white sm:text-4xl md:text-5xl">
                <AnimatedNumber value={stat.value} suffix={stat.suffix} />
              </p>
              <p className="mt-1 text-sm text-white/70">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
