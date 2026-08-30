import { useRef, useCallback } from "react";
import { fetchTTS } from "../lib/api";

const TTS_REQUEST_TIMEOUT_MS = 30000;

export function useTTS() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

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
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
        }

        let requestTimeoutId: ReturnType<typeof setTimeout> | null = null;
        let resolved = false;

        const safeResolve = () => {
          if (!resolved) {
            resolved = true;
            if (requestTimeoutId) clearTimeout(requestTimeoutId);
            resolve();
          }
        };

        const requestStart = performance.now();

        try {
          // Request timeout: only covers the HTTP fetch, not playback
          const controller = new AbortController();
          abortControllerRef.current = controller;

          const fetchPromise = fetchTTS(text, voice, speed, controller.signal);
          const timeoutPromise = new Promise<never>((_, reject) => {
            requestTimeoutId = setTimeout(() => {
              controller.abort();
              reject(new Error(`TTS request timed out after ${TTS_REQUEST_TIMEOUT_MS}ms`));
            }, TTS_REQUEST_TIMEOUT_MS);
          });

          const blob = await Promise.race([fetchPromise, timeoutPromise]);

          // Request succeeded — clear the request timeout
          if (requestTimeoutId) clearTimeout(requestTimeoutId);
          requestTimeoutId = null;

          const requestDuration = performance.now() - requestStart;
          console.log("[TTS] Request completed in", Math.round(requestDuration), "ms,", blob.size, "bytes");

          if (abortRef.current) {
            safeResolve();
            return;
          }

          // Create audio element and play — no timeout on playback
          const url = URL.createObjectURL(blob);
          const audio = new Audio();
          audioRef.current = audio;

          audio.preload = "auto";
          audio.src = url;

          const playStart = performance.now();

          audio.onended = () => {
            const playbackDuration = performance.now() - playStart;
            console.log("[TTS] Playback ended after", Math.round(playbackDuration), "ms");
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
          console.error("[TTS] Error:", err);
          if (requestTimeoutId) clearTimeout(requestTimeoutId);
          safeResolve();
        }
      });
    },
    []
  );

  const stop = useCallback(() => {
    abortRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
  }, []);

  return { speak, stop };
}
