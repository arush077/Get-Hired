const setupForm = document.getElementById("setup-form");
const setupSection = document.getElementById("setup-section");
const interviewSection = document.getElementById("interview-section");
const resultsSection = document.getElementById("results-section");
const qCountEl = document.getElementById("q-count");
const questionEl = document.getElementById("question-text");
const answerInput = document.getElementById("answer-input");
const submitBtn = document.getElementById("submit-btn");
const resultsList = document.getElementById("results-list");
const restartBtn = document.getElementById("restart-btn");

let interviewId = null;
let totalQuestions = 0;
let currentIndex = 0;

setupForm.addEventListener("submit", startInterview);
submitBtn.addEventListener("click", submitAnswer);
restartBtn.addEventListener("click", () => {
  resultsSection.hidden = true;
  setupSection.hidden = false;
});

async function startInterview(e) {
  e.preventDefault();

  const candidateName = document.getElementById("candidate-name").value.trim();
  const jobRole = document.getElementById("job-role").value.trim();
  if (!candidateName || !jobRole) return;

  submitBtn.disabled = true;
  setupSection.hidden = true;
  resultsSection.hidden = true;
  interviewSection.hidden = false;

  const res = await fetch("/api/interviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidate_name: candidateName, job_role: jobRole }),
  });
  const data = await res.json();

  interviewId = data.interview_id;
  totalQuestions = data.total_questions;
  currentIndex = 0;

  showQuestion(data.question, data.question_index);
}

function showQuestion(question, index) {
  questionEl.textContent = question;
  qCountEl.textContent = `Question ${index + 1} of ${totalQuestions}`;
  answerInput.value = "";
  answerInput.focus();
  submitBtn.disabled = false;
}

async function submitAnswer() {
  const transcript = answerInput.value.trim();
  submitBtn.disabled = true;

  const res = await fetch(`/api/interviews/${interviewId}/answers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript }),
  });
  const data = await res.json();

  if (data.next_question) {
    currentIndex = data.next_question_index;
    showQuestion(data.next_question, currentIndex);
  } else {
    await showResults();
  }
}

async function showResults() {
  interviewSection.hidden = true;
  resultsSection.hidden = false;
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
