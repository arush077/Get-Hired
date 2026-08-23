import { useRef, useCallback } from "react";
import { fetchTTS } from "../lib/api";

export function useTTS() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef(false);

  const speak = useCallback(
    (
      text: string,
      voice: string,
      speed: number
    ): Promise<void> => {
      return new Promise(async (resolve, reject) => {
        abortRef.current = false;

        // Stop any current audio
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = "";
          audioRef.current = null;
        }

        try {
          console.log("[TTS] START");
          const blob = await fetchTTS(text, voice, speed);

          if (abortRef.current) {
            resolve();
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
            resolve();
          };

          audio.onerror = (e) => {
            console.error("Audio playback error:", e);
            URL.revokeObjectURL(url);
            audioRef.current = null;
            resolve(); // still resolve so interview can continue
          };

          await audio.play();
        } catch (err) {
          reject(err);
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
