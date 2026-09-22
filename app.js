const STORAGE_KEY = "rational-number-practice-v1";
const core = window.RationalGameCore;

const levelInfo = {
  1: { title: "整數基礎", rank: "符號新手", mission: "正負整數加減", hint: "先看運算符號，再決定向左或向右移動。", avatar: "player-lv1.png" },
  2: { title: "括號變號", rank: "括號解碼員", mission: "拆開負數括號", hint: "減去負數會變成加上正數；加上負數則向負方向移動。", avatar: "player-lv4.png" },
  3: { title: "分數運算", rank: "有理數大師", mission: "負分數與異分母", hint: "先通分，再處理正負號，最後把答案約成最簡分數。", avatar: "player-lv7.png" },
};

let progress = loadProgress();
let question;
let entry = "";
let locked = false;
let questionNumber = 0;

const $ = (id) => document.getElementById(id);

function loadProgress() {
  const fallback = { level: 1, xp: 0, total: 0, correct: 0, streak: 0 };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...fallback, ...saved, level: Math.min(3, Math.max(1, Number(saved?.level) || 1)) };
  } catch {
    return fallback;
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function init() {
  document.querySelectorAll("[data-key]").forEach((button) => button.addEventListener("click", () => appendDigit(button.dataset.key)));
  document.querySelector("[data-action='backspace']").addEventListener("click", backspace);
  document.querySelector("[data-action='clear']").addEventListener("click", clearEntry);
  document.querySelector("[data-action='fraction']").addEventListener("click", addFractionBar);
  document.querySelector("[data-action='sign']").addEventListener("click", toggleSign);
  $("submit-answer").addEventListener("click", submitAnswer);
  $("continue-button").addEventListener("click", () => {
    $("level-dialog").close();
    nextQuestion();
  });
  $("reset-progress").addEventListener("click", () => $("reset-dialog").showModal());
  $("confirm-reset").addEventListener("click", resetProgress);
  document.addEventListener("keydown", handlePhysicalKeyboard);
  if (window.lucide) lucide.createIcons();
  updateProgressUI();
  nextQuestion();
}

function nextQuestion() {
  locked = false;
  entry = "";
  questionNumber += 1;
  question = core.generateQuestion(progress.level);
  $("question-number").textContent = questionNumber;
  $("question-type").textContent = question.type;
  $("feedback").className = "feedback";
  $("feedback").innerHTML = "";
  setKeypadDisabled(false);
  renderMath($("question-math"), question.tex);
  renderEntry();
}

function appendDigit(digit) {
  if (locked || entry.length >= 10) return;
  if (entry === "0") entry = digit;
  else if (entry === "-0") entry = `-${digit}`;
  else entry += digit;
  renderEntry();
}

function toggleSign() {
  if (locked) return;
  entry = entry.startsWith("-") ? entry.slice(1) : `-${entry}`;
  renderEntry();
}

function addFractionBar() {
  if (locked || entry.includes("/")) return;
  const unsigned = entry.startsWith("-") ? entry.slice(1) : entry;
  if (!unsigned) return;
  entry += "/";
  renderEntry();
}

function backspace() {
  if (locked) return;
  entry = entry.slice(0, -1);
  renderEntry();
}

function clearEntry() {
  if (locked) return;
  entry = "";
  renderEntry();
}

function entryToTex() {
  if (!entry || entry === "-") return "";
  const negative = entry.startsWith("-");
  const unsigned = negative ? entry.slice(1) : entry;
  if (!unsigned.includes("/")) return `${negative ? "-" : ""}${unsigned}`;
  const [numerator, denominator] = unsigned.split("/");
  return `${negative ? "-" : ""}\\frac{${numerator || "\\square"}}{${denominator || "\\square"}}`;
}

function renderEntry() {
  const display = $("answer-display");
  const tex = entryToTex();
  display.classList.toggle("empty", !tex);
  if (!tex) display.innerHTML = '<span class="answer-placeholder">?</span>';
  else renderMath(display, tex);
  $("submit-answer").disabled = !core.parseAnswer(entry) || locked;
}

function renderMath(element, tex) {
  element.innerHTML = `\\[${tex}\\]`;
  if (window.MathJax?.typesetPromise) MathJax.typesetPromise([element]).catch(console.error);
}

function submitAnswer() {
  if (locked) return;
  const answer = core.parseAnswer(entry);
  if (!answer) return;
  locked = true;
  const correct = answer.equals(question.answer);
  const result = core.applyResult(progress, correct);
  progress = result.progress;
  saveProgress();
  setKeypadDisabled(true);
  showFeedback(correct);
  updateProgressUI();

  window.setTimeout(() => {
    if (result.leveledUp) showLevelDialog(false);
    else if (result.completed) showLevelDialog(true);
    else nextQuestion();
  }, 1150);
}

function showFeedback(correct) {
  const feedback = $("feedback");
  feedback.className = `feedback show ${correct ? "correct" : "wrong"}`;
  feedback.innerHTML = `<strong>${correct ? "+15 XP　判斷正確" : "-10 XP　再試一題"}</strong><span>正確答案：<span id="correct-answer-math"></span></span>`;
  renderMath($("correct-answer-math"), core.fractionTex(question.answer));
}

function setKeypadDisabled(disabled) {
  $("keypad").querySelectorAll("button").forEach((button) => { button.disabled = disabled; });
}

function updateProgressUI() {
  const info = levelInfo[progress.level];
  $("level-kicker").textContent = `LEVEL ${progress.level}`;
  $("level-title").textContent = info.title;
  $("xp-copy").textContent = `${progress.xp} / 300`;
  $("xp-bar").style.width = `${Math.min(100, (progress.xp / 300) * 100)}%`;
  $("xp-bar").parentElement.setAttribute("aria-valuenow", progress.xp);
  $("correct-count").textContent = progress.correct;
  $("streak-count").textContent = progress.streak;
  $("player-avatar").src = info.avatar;
  $("rank-chip").textContent = info.rank;
  $("mission-title").textContent = info.mission;
  $("mission-hint").textContent = info.hint;

  document.querySelectorAll("[data-level-dot]").forEach((dot) => {
    const level = Number(dot.dataset.levelDot);
    dot.classList.toggle("active", level === progress.level);
    dot.classList.toggle("done", level < progress.level);
  });
  document.querySelectorAll("[data-level-card]").forEach((card) => {
    const level = Number(card.dataset.levelCard);
    card.classList.toggle("active", level === progress.level);
    card.classList.toggle("done", level < progress.level);
    const icon = card.querySelector("i, svg");
    if (icon) icon.setAttribute("data-lucide", level <= progress.level ? "check" : "lock-keyhole");
  });
  if (window.lucide) lucide.createIcons();
}

function showLevelDialog(completed) {
  const info = levelInfo[progress.level];
  $("dialog-avatar").src = info.avatar;
  $("dialog-kicker").textContent = completed ? "MASTERED" : "LEVEL UP";
  $("dialog-title").textContent = completed ? "完成全部關卡" : `進入程度${["一", "二", "三"][progress.level - 1]}`;
  $("dialog-copy").textContent = completed ? "你已完成 900 XP 的有理數訓練。" : `${info.title}已解鎖。`;
  $("continue-button").textContent = completed ? "繼續練習" : "開始下一關";
  $("level-dialog").showModal();
}

function handlePhysicalKeyboard(event) {
  if (/^\d$/.test(event.key)) appendDigit(event.key);
  else if (event.key === "-") toggleSign();
  else if (event.key === "/") addFractionBar();
  else if (event.key === "Backspace") backspace();
  else if (event.key === "Escape") clearEntry();
  else if (event.key === "Enter" && !$("submit-answer").disabled) submitAnswer();
}

function resetProgress() {
  progress = { level: 1, xp: 0, total: 0, correct: 0, streak: 0 };
  saveProgress();
  questionNumber = 0;
  $("reset-dialog").close();
  updateProgressUI();
  nextQuestion();
}

document.addEventListener("DOMContentLoaded", init);
