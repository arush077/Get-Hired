import { useRef, useCallback } from "react";

const KEEPALIVE_MS = 10_000;
const CHARS_PER_SEC = 15;
const FALLBACK_BUFFER_S = 3;

const KNOWN_GOOD = ["Google US English", "Samantha", "Alex", "Microsoft Zira", "Microsoft David"];

function findVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => v.lang.startsWith("en"));
  if (english.length === 0) return null;

  for (const name of KNOWN_GOOD) {
    const match = english.find((v) => v.name === name);
    if (match) return match;
  }

  const local = english.filter((v) => v.localService);
  if (local.length > 0) {
    return local.find((v) => v.lang === "en-US") ?? local[0];
  }

  return english.find((v) => v.lang === "en-US") ?? english[0];
}

function ensureVoicesLoaded(): Promise<void> {
  const synth = window.speechSynthesis;
  if (synth.getVoices().length > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const onLoaded = () => {
      synth.removeEventListener("voiceschanged", onLoaded);
      resolve();
    };
    synth.addEventListener("voiceschanged", onLoaded);
  });
}

export function useTTS() {
  const voiceNameRef = useRef<string | null>(null);
  const stoppedRef = useRef(false);
  const keepaliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const utteranceIdRef = useRef(0);

  const clearKeepalive = useCallback(() => {
    if (keepaliveRef.current !== null) {
      clearInterval(keepaliveRef.current);
      keepaliveRef.current = null;
    }
  }, []);

  const resolveVoice = useCallback(async (): Promise<SpeechSynthesisVoice | null> => {
    await ensureVoicesLoaded();
    const voices = window.speechSynthesis.getVoices();

    if (voiceNameRef.current) {
      const cached = voices.find((v) => v.name === voiceNameRef.current);
      if (cached) return cached;
    }

    const voice = findVoice(voices);
    if (voice) {
      voiceNameRef.current = voice.name;
    }
    return voice;
  }, []);

  const speak = useCallback(
    (text: string, questionNum?: number): Promise<void> => {
      const id = ++utteranceIdRef.current;
      const label = questionNum != null ? `Q${questionNum}` : "Q?";

      return new Promise(async (resolve) => {
        stoppedRef.current = false;
        clearKeepalive();

        const synth = window.speechSynthesis;

        if (synth.speaking || synth.pending) {
          synth.cancel();
        }

        const voice = await resolveVoice();

        if (id !== utteranceIdRef.current) {
          resolve();
          return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US";
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        if (voice) {
          utterance.voice = voice;
        }

        console.log(
          `[TTS] ${label} voice:`, voice?.name ?? "default",
          "| lang:", utterance.lang,
          "| local:", voice?.localService,
          "| uri:", voice?.voiceURI,
          "| cached name:", voiceNameRef.current,
        );

        const expectedMs =
          (text.length / CHARS_PER_SEC) * 1000 + FALLBACK_BUFFER_S * 1000;
        let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

        const cleanup = () => {
          clearKeepalive();
          if (fallbackTimer !== null) {
            clearTimeout(fallbackTimer);
            fallbackTimer = null;
          }
        };

        const safeResolve = () => {
          if (id !== utteranceIdRef.current) return;
          cleanup();
          resolve();
        };

        utterance.onend = () => safeResolve();

        utterance.onerror = (e) => {
          if (id !== utteranceIdRef.current) return;
          if (stoppedRef.current || e.error === "canceled") {
            safeResolve();
          } else {
            console.error("[TTS] Speech error:", e.error);
            safeResolve();
          }
        };

        fallbackTimer = setTimeout(() => {
          if (id !== utteranceIdRef.current) return;
          if (!stoppedRef.current && synth.speaking) {
            console.warn("[TTS] onend never fired, force-resolving");
            synth.cancel();
          }
          safeResolve();
        }, expectedMs);

        synth.speak(utterance);

        keepaliveRef.current = setInterval(() => {
          if (!synth.speaking) {
            clearKeepalive();
            return;
          }
          synth.pause();
          synth.resume();
        }, KEEPALIVE_MS);
      });
    },
    [resolveVoice, clearKeepalive],
  );

  const stop = useCallback(() => {
    stoppedRef.current = true;
    clearKeepalive();
    window.speechSynthesis.cancel();
  }, [clearKeepalive]);

  const reset = useCallback(() => {
    voiceNameRef.current = null;
  }, []);

  return { speak, stop, reset };
}
