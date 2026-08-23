import { useRef, useState, useCallback } from "react";

export function useSpeechRecognition() {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const finalTranscriptRef = useRef("");
  const listeningRef = useRef(false);

  const SpeechRecognition =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  const start = useCallback(
    (onError?: (error: string) => void) => {
      if (!SpeechRecognition) {
        onError?.("unsupported");
        return;
      }

      finalTranscriptRef.current = "";
      setTranscript("");

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const chunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscriptRef.current += chunk.trim() + " ";
          } else {
            interim += chunk;
          }
        }
        setTranscript((finalTranscriptRef.current + interim).trim());
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === "not-allowed") {
          listeningRef.current = false;
          setListening(false);
          onError?.("error");
        }
      };

      recognition.onend = () => {
        console.log("[STT] ended");
        if (listeningRef.current) {
          console.log("[STT] unexpectedly ended");
          listeningRef.current = false;
          setListening(false);
        }
      };

      recognitionRef.current = recognition;
      listeningRef.current = true;
      recognition.start();
      setListening(true);
    },
    [SpeechRecognition]
  );

  const stop = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      listeningRef.current = false;
      setListening(false);

      const r = recognitionRef.current;
      if (!r) {
        console.log("[STT] Fully stopped - no instance");
        resolve();
        return;
      }

      console.log("[STT] Requesting stop...");

      r.onend = () => {
        console.log("[STT] Fully stopped");
        recognitionRef.current = null;
        resolve();
      };

      try {
        r.stop();
      } catch (e) {
        console.log("[STT] stop() error:", e);
        recognitionRef.current = null;
        resolve();
      }
    });
  }, []);

  const getTranscript = useCallback(() => {
    return finalTranscriptRef.current.trim();
  }, []);

  return {
    listening,
    transcript,
    start,
    stop,
    getTranscript,
  };
}
