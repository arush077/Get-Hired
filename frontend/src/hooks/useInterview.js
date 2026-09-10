import { useState, useCallback, useRef } from "react";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { useTTS } from "./useTTS";
import {
  startInterview as apiStart,
  submitAnswer,
  getResults,
} from "../lib/api";
import { getUser } from "../lib/auth";

export function useInterview() {
  const [state, setState] = useState("documents");
  const [question, setQuestion] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [results, setResults] = useState([]);
  const [interviewId, setInterviewId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysis, setAnalysis] = useState(null);

  const stt = useSpeechRecognition();
  const tts = useTTS();
  const qCounterRef = useRef(0);

  const start = useCallback(
    async (jobRole, resumeText, jdText, resumeId, interviewMode) => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiStart({
          candidateName: getUser()?.name || "Candidate",
          jobRole,
          resumeText: resumeId ? undefined : resumeText,
          resumeId: resumeId,
          jdText,
          interviewMode,
        });
        setInterviewId(data.interview_id);
        setQuestion(data.question);
        setQuestionIndex(data.question_index);
        setTotalQuestions(data.total_questions);
        setState("speaking");
        qCounterRef.current = 1;
        await tts.speak(data.question, 1);
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
        await tts.speak(data.next_question ?? question, qCounterRef.current);
        setState("ready");
      } else if (data.next_question) {
        const nextIdx = (data.next_question_index ?? questionIndex + 1);
        setQuestionIndex(nextIdx);
        setTotalQuestions(data.total_questions ?? totalQuestions);
        setQuestion(data.next_question);
        qCounterRef.current = nextIdx + 1;
        setState("speaking");
        await tts.speak(data.next_question, nextIdx + 1);
        setState("ready");
      } else {
        if (data.analysis) setAnalysis(data.analysis);
        try {
          const resData = await getResults(interviewId);
          setResults(resData?.results ?? []);
          if (resData?.analysis) setAnalysis(resData.analysis);
        } catch (getErr) {
          console.error("[INTERVIEW] getResults failed:", getErr);
        }
        setState("results");
      }
    } catch (err) {
      console.error("[INTERVIEW] finishAnswer error:", err);
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
      setState("results");
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
    qCounterRef.current = 0;
    tts.reset();
  }, [tts]);

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
