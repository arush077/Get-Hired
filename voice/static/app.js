const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");
const finishBtn = document.getElementById("finish-btn");
const voiceSelect = document.getElementById("voice-select");
const statusEl = document.getElementById("status");
const questionEl = document.getElementById("question-text");
const qCountEl = document.getElementById("q-count");
const transcriptEl = document.getElementById("transcript");
const resultsSection = document.getElementById("results-section");
const resultsList = document.getElementById("results-list");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;
let listening = false;
let finalTranscript = "";
let questions = [];
let current = 0;
let voices = [];

speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

startBtn.addEventListener("click", startInterview);
restartBtn.addEventListener("click", startInterview);
finishBtn.addEventListener("click", finishAnswer);

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

async function startInterview() {
  startBtn.disabled = true;
  restartBtn.disabled = true;
  resultsSection.hidden = true;
  resultsList.innerHTML = "";
  transcriptEl.hidden = false;

  await fetch("/api/interview/start", { method: "POST" });
  const res = await fetch("/api/questions");
  questions = (await res.json()).questions;
  current = 0;
  askQuestion();
}

function askQuestion() {
  finalTranscript = "";
  transcriptEl.textContent = "";
  questionEl.textContent = questions[current];
  qCountEl.textContent = `Question ${current + 1} of ${questions.length}`;
  setStatus("speaking");
  speak(questions[current], () => startListening());
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

  await fetch("/api/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ index: current, answer: finalTranscript.trim() }),
  });

  current += 1;
  if (current < questions.length) {
    askQuestion();
  } else {
    await showResults();
  }
}

async function showResults() {
  setStatus("done");
  questionEl.textContent = "";
  qCountEl.textContent = "";
  transcriptEl.hidden = true;

  const res = await fetch("/api/results");
  const data = await res.json();

  resultsList.innerHTML = "";
  data.results.forEach((item) => {
    const div = document.createElement("div");
    div.className = "result-item";
    const q = document.createElement("p");
    q.className = "result-q";
    q.textContent = `Q${item.index + 1}: ${item.question}`;
    const a = document.createElement("p");
    a.className = "result-a";
    a.textContent = item.answer || "(no answer captured)";
    div.appendChild(q);
    div.appendChild(a);
    resultsList.appendChild(div);
  });

  resultsSection.hidden = false;
  startBtn.disabled = false;
  restartBtn.disabled = false;
}

function setStatus(state) {
  const labels = {
    idle: "Idle",
    speaking: "Speaking…",
    listening: "Listening…",
    done: "Interview complete",
    unsupported: "Speech recognition not supported in this browser",
    error: "Microphone access denied",
  };
  statusEl.textContent = labels[state] || state;
  statusEl.dataset.state = state;
}
