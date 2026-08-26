import { useState, useCallback, useRef } from "react";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { useTTS } from "./useTTS";
import {
  startInterview as apiStart,
  submitAnswer,
  getResults,
  type ResultItem,
} from "../lib/api";

export type InterviewState =
  | "setup"
  | "documents"
  | "speaking"
  | "ready"
  | "listening"
  | "waiting"
  | "results";

const DEFAULT_VOICE = "en-US-AvaNeural";
const DEFAULT_SPEED = 1.0;

export function useInterview() {
  const [state, setState] = useState<InterviewState>("setup");
  const [question, setQuestion] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setupRef = useRef<{ name: string; jobRole: string } | null>(null);

  const stt = useSpeechRecognition();
  const tts = useTTS();

  const goToDocuments = useCallback(
    (candidateName: string, jobRole: string) => {
      setupRef.current = { name: candidateName, jobRole };
      setState("documents");
    },
    []
  );

  const start = useCallback(
    async (resumeText: string, jdText: string) => {
      const setup = setupRef.current;
      if (!setup) return;

      setLoading(true);
      setError(null);
      try {
        const data = await apiStart(setup.name, setup.jobRole, resumeText, jdText);
        setInterviewId(data.interview_id);
        setQuestion(data.question);
        setQuestionIndex(data.question_index);
        setTotalQuestions(data.total_questions);
        setState("speaking");
        await tts.speak(data.question, DEFAULT_VOICE, DEFAULT_SPEED);
        setState("ready");
      } finally {
        setLoading(false);
      }
    },
    [tts]
  );

  const startAnswer = useCallback(() => {
    setState("listening");
    stt.start((error) => {
      if (error === "unsupported") {
        setState("setup");
      }
    });
  }, [stt]);

  const finishAnswer = useCallback(async () => {
    setState("waiting");
    setError(null);

    try {
      await stt.stop();

      console.log("[AUDIO] Waiting 2s before TTS...");
      await new Promise((r) => setTimeout(r, 2000));
      console.log("[AUDIO] Starting TTS");

      const transcript = stt.getTranscript();

      if (!interviewId) return;

      const data = await submitAnswer(interviewId, transcript);

      if (data.next_question) {
        setQuestionIndex(data.next_question_index ?? questionIndex + 1);
        setTotalQuestions(data.total_questions ?? totalQuestions);
        setQuestion(data.next_question);
        setState("speaking");
        await tts.speak(data.next_question, DEFAULT_VOICE, DEFAULT_SPEED);
        setState("ready");
      } else {
        const resData = await getResults(interviewId);
        setResults(resData.results);
        setState("results");
      }
    } catch (err) {
      console.error("[INTERVIEW] finishAnswer error:", err);
      setError("Something went wrong. Please try again.");
      setState("ready");
    }
  }, [stt, tts, interviewId, questionIndex, totalQuestions]);

  const restart = useCallback(() => {
    setState("setup");
    setInterviewId(null);
    setQuestion("");
    setQuestionIndex(0);
    setTotalQuestions(0);
    setResults([]);
    setupRef.current = null;
  }, []);

  return {
    state,
    question,
    questionIndex,
    totalQuestions,
    results,
    loading,
    error,
    transcript: stt.transcript,
    goToDocuments,
    start,
    startAnswer,
    finishAnswer,
    restart,
  };
}
