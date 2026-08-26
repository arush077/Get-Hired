import { useRef, useCallback } from "react";
import { fetchTTS } from "../lib/api";

const TTS_TIMEOUT_MS = 15000;

export function useTTS() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef(false);

  const speak = useCallback(
    (
      text: string,
      voice: string,
      speed: number
    ): Promise<void> => {
      return new Promise(async (resolve) => {
        abortRef.current = false;

        // Stop any current audio
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = "";
          audioRef.current = null;
        }

        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let resolved = false;

        const safeResolve = () => {
          if (!resolved) {
            resolved = true;
            if (timeoutId) clearTimeout(timeoutId);
            resolve();
          }
        };

        timeoutId = setTimeout(() => {
          console.warn("[TTS] Timed out after", TTS_TIMEOUT_MS, "ms");
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = "";
            audioRef.current = null;
          }
          safeResolve();
        }, TTS_TIMEOUT_MS);

        try {
          console.log("[TTS] START");
          const blob = await fetchTTS(text, voice, speed);

          if (abortRef.current) {
            safeResolve();
            return;
          }

          console.log("TTS:", { type: blob.type, size: blob.size });

          const url = URL.createObjectURL(blob);
          const audio = new Audio();
          audioRef.current = audio;

          audio.preload = "auto";
          audio.src = url;

          audio.onloadedmetadata = () => {
            console.log("Audio duration:", audio.duration);
          };

          audio.onended = () => {
            console.log("[TTS] END");
            URL.revokeObjectURL(url);
            audioRef.current = null;
            safeResolve();
          };

          audio.onerror = (e) => {
            console.error("[TTS] Audio playback error:", e);
            URL.revokeObjectURL(url);
            audioRef.current = null;
            safeResolve();
          };

          await audio.play();
        } catch (err) {
          console.error("[TTS] Fetch error:", err);
          safeResolve();
        }
      });
    },
    []
  );

  const stop = useCallback(() => {
    abortRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
  }, []);

  return { speak, stop };
}
