const setupForm = document.getElementById("setup-form");
const setupSection = document.getElementById("setup-section");
const interviewSection = document.getElementById("interview-section");
const resultsSection = document.getElementById("results-section");
const qCountEl = document.getElementById("q-count");
const questionEl = document.getElementById("question-text");
const statusEl = document.getElementById("status");
const transcriptEl = document.getElementById("transcript");
const startAnswerBtn = document.getElementById("start-answer-btn");
const finishBtn = document.getElementById("finish-btn");
const resultsList = document.getElementById("results-list");
const restartBtn = document.getElementById("restart-btn");
const voiceSelect = document.getElementById("voice-select");
const speedSlider = document.getElementById("speed-slider");
const speedValue = document.getElementById("speed-value");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const VOICES = [
  { value: "en-US-AvaNeural", label: "Ava (US, Female)" },
  { value: "en-US-AndrewNeural", label: "Andrew (US, Male)" },
  { value: "en-US-EmmaNeural", label: "Emma (US, Female)" },
  { value: "en-US-BrianNeural", label: "Brian (US, Male)" },
  { value: "en-GB-SoniaNeural", label: "Sonia (UK, Female)" },
  { value: "en-GB-RyanNeural", label: "Ryan (UK, Male)" },
  { value: "en-AU-NatashaNeural", label: "Natasha (AU, Female)" },
  { value: "en-IN-PrabhatNeural", label: "Prabhat (IN, Male)" },
  { value: "en-IE-EmilyNeural", label: "Emily (IE, Female)" },
];

let recognition = null;
let listening = false;
let finalTranscript = "";
let interviewId = null;
let totalQuestions = 0;
let currentIndex = 0;
let currentAudio = null;

// Populate voice dropdown
VOICES.forEach((v) => {
  const option = document.createElement("option");
  option.value = v.value;
  option.textContent = v.label;
  voiceSelect.appendChild(option);
});

// Speed slider display
speedSlider.addEventListener("input", () => {
  speedValue.textContent = `${parseFloat(speedSlider.value).toFixed(1)}x`;
});

setupForm.addEventListener("submit", startInterview);
startAnswerBtn.addEventListener("click", startListening);
finishBtn.addEventListener("click", finishAnswer);
restartBtn.addEventListener("click", () => {
  resultsSection.hidden = true;
  setupSection.hidden = false;
  setStatus("idle");
});

async function startInterview(e) {
  e.preventDefault();

  const candidateName = document.getElementById("candidate-name").value.trim();
  const jobRole = document.getElementById("job-role").value.trim();
  if (!candidateName || !jobRole) return;

  setupSection.hidden = true;
  resultsSection.hidden = true;
  interviewSection.hidden = false;
  transcriptEl.hidden = false;
  transcriptEl.textContent = "";
  startAnswerBtn.hidden = true;
  finishBtn.hidden = true;

  const res = await fetch("/api/interviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidate_name: candidateName, job_role: jobRole }),
  });
  const data = await res.json();

  interviewId = data.interview_id;
  totalQuestions = data.total_questions;
  currentIndex = 0;

  questionEl.textContent = data.question;
  qCountEl.textContent = `Question ${data.question_index + 1} of ${totalQuestions}`;
  setStatus("speaking");
  await speak(data.question);
}

async function speak(text) {
  console.log("[TTS] START");
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }

  const res = await fetch("/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      voice: voiceSelect.value,
      speed: parseFloat(speedSlider.value),
    }),
  });

  if (!res.ok) {
    throw new Error("TTS request failed");
  }

  const blob = await res.blob();

  console.log("TTS:", {
    type: blob.type,
    size: blob.size,
  });

  const url = URL.createObjectURL(blob);
  const audio = new Audio();

  currentAudio = audio;

  audio.preload = "auto";
  audio.src = url;

  audio.onloadedmetadata = () => {
    console.log("Audio duration:", audio.duration);
  };

  audio.onended = () => {
    console.log("[TTS] END");

    URL.revokeObjectURL(url);
    currentAudio = null;

    startAnswerBtn.hidden = false;
    setStatus("listening");
  };

  audio.onerror = (e) => {
    console.error("Audio playback error:", e);

    URL.revokeObjectURL(url);
    currentAudio = null;

    startAnswerBtn.hidden = false;
    setStatus("listening");
  };

  await audio.play();
}

function startListening() {
  console.log("[STT] START");
  if (!SpeechRecognition) {
    setStatus("unsupported");
    return;
  }

  startAnswerBtn.hidden = true;
  setStatus("listening");
  finishBtn.hidden = false;
  listening = true;
  finalTranscript = "";
  transcriptEl.textContent = "";

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const chunk = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += chunk.trim() + " ";
      } else {
        interim += chunk;
      }
    }
    transcriptEl.textContent = (finalTranscript + interim).trim();
  };

  recognition.onerror = (event) => {
    if (event.error === "not-allowed") {
      listening = false;
      finishBtn.hidden = true;
      startAnswerBtn.hidden = true;
      setStatus("error");
    }
  };

  recognition.onend = () => {
    console.log("[STT] ended");
    if (listening) {
      console.log("[STT] unexpectedly ended");
      listening = false;
      finishBtn.hidden = true;
      startAnswerBtn.hidden = false;
    }
  };

  recognition.start();
}

function stopListening() {
  return new Promise((resolve) => {
    listening = false;

    if (!recognition) {
      console.log("[STT] Fully stopped - no instance");
      resolve();
      return;
    }

    const r = recognition;

    console.log("[STT] Requesting stop...");

    r.onend = () => {
      console.log("[STT] Fully stopped");

      if (recognition === r) {
        recognition = null;
      }

      resolve();
    };

    try {
      r.stop();
    } catch (e) {
      console.log("[STT] stop() error:", e);

      if (recognition === r) {
        recognition = null;
      }

      resolve();
    }
  });
}

async function finishAnswer() {
  finishBtn.hidden = true;
  startAnswerBtn.hidden = true;

  // Wait until Chrome actually releases STT
  await stopListening();

  // TEST: 3 second delay to prove/disprove mic release timing hypothesis
  console.log("[AUDIO] Waiting 2s before TTS...");
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log("[AUDIO] Starting TTS");

  const transcript = finalTranscript.trim();

  const res = await fetch(`/api/interviews/${interviewId}/answers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript }),
  });
  const data = await res.json();

  if (data.next_question) {
    currentIndex = data.next_question_index;
    questionEl.textContent = data.next_question;
    qCountEl.textContent = `Question ${currentIndex + 1} of ${totalQuestions}`;
    transcriptEl.textContent = "";
    setStatus("speaking");
    // Mic is GUARANTEED to have stopped here
    await speak(data.next_question);
  } else {
    await showResults();
  }
}

async function showResults() {
  setStatus("done");
  interviewSection.hidden = true;
  resultsSection.hidden = false;
  transcriptEl.hidden = true;
  resultsList.innerHTML = "";

  const res = await fetch(`/api/interviews/${interviewId}/results`);
  const data = await res.json();

  data.results.forEach((item) => {
    const div = document.createElement("div");
    div.className = "result-item";

    const q = document.createElement("p");
    q.className = "result-q";
    q.textContent = `Q${item.question_index + 1}: ${item.question}`;

    const a = document.createElement("p");
    a.className = "result-a";
    a.textContent = item.answer || "(no answer captured)";

    div.appendChild(q);
    div.appendChild(a);
    resultsList.appendChild(div);
  });
}

function setStatus(state) {
  const labels = {
    idle: "Idle",
    speaking: "Speaking\u2026",
    listening: "Listening\u2026",
    done: "Interview complete",
    unsupported: "Speech recognition not supported in this browser",
    error: "Microphone access denied",
  };
  statusEl.textContent = labels[state] || state;
  statusEl.dataset.state = state;
}
