const setupForm = document.getElementById("setup-form");
const setupSection = document.getElementById("setup-section");
const interviewSection = document.getElementById("interview-section");
const resultsSection = document.getElementById("results-section");
const qCountEl = document.getElementById("q-count");
const questionEl = document.getElementById("question-text");
const statusEl = document.getElementById("status");
const transcriptEl = document.getElementById("transcript");
const finishBtn = document.getElementById("finish-btn");
const resultsList = document.getElementById("results-list");
const restartBtn = document.getElementById("restart-btn");
const voiceSelect = document.getElementById("voice-select");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;
let listening = false;
let finalTranscript = "";
let interviewId = null;
let totalQuestions = 0;
let currentIndex = 0;
let voices = [];

speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

setupForm.addEventListener("submit", startInterview);
finishBtn.addEventListener("click", finishAnswer);
restartBtn.addEventListener("click", () => {
  resultsSection.hidden = true;
  setupSection.hidden = false;
  setStatus("idle");
});

function loadVoices() {
  voices = speechSynthesis.getVoices();
  if (!voices.length) return;
  voiceSelect.innerHTML = "";
  voices.forEach((voice) => {
    const option = document.createElement("option");
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})`;
    voiceSelect.appendChild(option);
  });
}

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
  speak(data.question, () => startListening());
}

function speak(text, onDone) {
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const selected = voices.find((v) => v.name === voiceSelect.value);
  if (selected) utterance.voice = selected;
  utterance.onend = () => setTimeout(onDone, 400);
  speechSynthesis.speak(utterance);
}

function startListening() {
  if (!SpeechRecognition) {
    setStatus("unsupported");
    return;
  }

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
      setStatus("error");
    }
  };

  recognition.onend = () => {
    if (listening) {
      try {
        recognition.start();
      } catch (_) {}
    }
  };

  recognition.start();
}

async function finishAnswer() {
  listening = false;
  if (recognition) recognition.stop();
  finishBtn.hidden = true;

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
    speak(data.next_question, () => startListening());
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
