import { useState, useCallback } from "react";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { useTTS } from "./useTTS";
import {
  startInterview as apiStart,
  submitAnswer,
  getResults,
  type ResultItem,
  type Analysis,
} from "../lib/api";

export type InterviewState =
  | "documents"
  | "speaking"
  | "ready"
  | "listening"
  | "waiting"
  | "results";

const DEFAULT_VOICE = "en-US-AvaNeural";
const DEFAULT_SPEED = 1.0;

export function useInterview() {
  const [state, setState] = useState<InterviewState>("documents");
  const [question, setQuestion] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  const stt = useSpeechRecognition();
  const tts = useTTS();

  const start = useCallback(
    async (jobRole: string, resumeText: string, jdText: string, resumeId?: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiStart({
          candidateName: "Candidate",
          jobRole,
          resumeText: resumeId ? undefined : resumeText,
          resumeId: resumeId,
          jdText,
        });
        setInterviewId(data.interview_id);
        setQuestion(data.question);
        setQuestionIndex(data.question_index);
        setTotalQuestions(data.total_questions);
        setState("speaking");
        await tts.speak(data.question, DEFAULT_VOICE, DEFAULT_SPEED);
        setState("ready");
      } catch (err) {
        console.error("[INTERVIEW] start error:", err);
        const message =
          err instanceof Error ? err.message : "Something went wrong. Please try again.";
        setError(message);
        setState("documents");
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
        setState("documents");
      }
    });
  }, [stt]);

  const finishAnswer = useCallback(async () => {
    setState("waiting");
    setError(null);

    try {
      await stt.stop();

      await new Promise((r) => setTimeout(r, 2000));

      const transcript = stt.getTranscript();

      if (!interviewId) return;

      const data = await submitAnswer(interviewId, transcript);

      if (data.is_clarification) {
        setQuestion(data.next_question ?? question);
        setState("speaking");
        await tts.speak(data.next_question ?? question, DEFAULT_VOICE, DEFAULT_SPEED);
        setState("ready");
      } else if (data.next_question) {
        setQuestionIndex(data.next_question_index ?? questionIndex + 1);
        setTotalQuestions(data.total_questions ?? totalQuestions);
        setQuestion(data.next_question);
        setState("speaking");
        await tts.speak(data.next_question, DEFAULT_VOICE, DEFAULT_SPEED);
        setState("ready");
      } else {
        if (data.analysis) setAnalysis(data.analysis);
        const resData = await getResults(interviewId);
        setResults(resData.results);
        if (resData.analysis) setAnalysis(resData.analysis);
        setState("results");
      }
    } catch (err) {
      console.error("[INTERVIEW] finishAnswer error:", err);
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
      setState("ready");
    }
  }, [stt, tts, interviewId, questionIndex, totalQuestions]);

  const restart = useCallback(() => {
    setState("documents");
    setInterviewId(null);
    setQuestion("");
    setQuestionIndex(0);
    setTotalQuestions(0);
    setResults([]);
    setAnalysis(null);
  }, []);

  return {
    state,
    question,
    questionIndex,
    totalQuestions,
    results,
    analysis,
    loading,
    error,
    transcript: stt.transcript,
    start,
    startAnswer,
    finishAnswer,
    restart,
  };
}
