const STORAGE_KEY = "rational-number-practice-v1";
const API_URL = window.RATIONAL_CONFIG?.apiUrl || "";
const core = window.RationalGameCore;

const studentDB = {
  SG1A: { 1:"歐陽周政",2:"歐芷菱",3:"蔡銀杰",4:"陳俊希",5:"陳炯文",6:"陳宇恆",7:"陳柏豪",8:"卓莉珊",9:"莊超穎",10:"鍾欣澄",11:"馮子軒",12:"黃鈞亮",13:"林立",14:"李振豪",15:"李梓琪",16:"李沁穎",17:"李宇杰",18:"梁依靜",19:"梁羽盈",20:"盧佩辰",21:"黃夢琪",22:"趙家美",23:"歐陽浩賢",24:"陳家莉",25:"歐承澔",26:"張子茵",27:"徐希瑜",28:"邢嘉豪",29:"楊昊宇",30:"邱嘉成",31:"郭添滿",32:"王思淇",33:"黃鈺裕",34:"黃健樺" },
  SG1B: { 1:"陳  毅",2:"曾蔚喬",3:"鄭凱琳",4:"陳思如",5:"程家儀",6:"張芯然",7:"蔡朗然",8:"董詩予",9:"馮家宥",10:"管梓皓",11:"黎芷盈",12:"劉德偉",13:"李善婷",14:"李雅琪",15:"凌寶旋",16:"吳靖怡",17:"宋允曦",18:"譚梓軒",19:"譚詩敏",20:"袁渟欣",21:"曾凱龍",22:"鄭家林",23:"張昊臻",24:"何家浩",25:"陳梓峰",26:"林灝晴",27:"林文軒",28:"梁王恩",30:"盧家豪",31:"勞允睿",32:"勞允堤",33:"黃曉樂",34:"王敬興" },
};

const levelInfo = {
  1: { title: "整數基礎", rank: "符號新手", mission: "正負整數加減", hint: "先看運算符號，再決定向左或向右移動。", avatar: "player-lv1.png" },
  2: { title: "括號變號", rank: "括號解碼員", mission: "拆開負數括號", hint: "減去負數會變成加上正數；加上負數則向負方向移動。", avatar: "player-lv4.png" },
  3: { title: "分數運算", rank: "有理數大師", mission: "負分數與異分母", hint: "先通分，再處理正負號，最後把答案約成最簡分數。", avatar: "player-lv7.png" },
};

let progress = defaultProgress();
let player = null;
let question;
let entry = "";
let locked = false;
let questionNumber = 0;
let pendingAnswers = [];
let pendingDamage = 0;
let syncInFlight = false;
let syncQueued = false;

const $ = (id) => document.getElementById(id);

function defaultProgress() {
  return { level: 1, xp: 0, total: 0, correct: 0, streak: 0, mistakes: 0 };
}

function playerStorageKey() {
  return `${STORAGE_KEY}:${player.className}:${player.id}`;
}

function loadProgress() {
  const fallback = defaultProgress();
  try {
    const saved = JSON.parse(localStorage.getItem(playerStorageKey()));
    return { ...fallback, ...saved, level: Math.min(3, Math.max(1, Number(saved?.level) || 1)) };
  } catch {
    return fallback;
  }
}

function saveProgress() {
  if (player) localStorage.setItem(playerStorageKey(), JSON.stringify(progress));
}

function init() {
  populateLogin();
  $("class-select").addEventListener("change", () => { updateIdOptions(); updateStudentPreview(); });
  $("id-select").addEventListener("change", updateStudentPreview);
  $("login-button").addEventListener("click", login);
  $("logout-button").addEventListener("click", () => location.reload());
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
}

function populateLogin() {
  Object.keys(studentDB).forEach((className) => $("class-select").add(new Option(className, className)));
  updateIdOptions();
  updateStudentPreview();
}

function updateIdOptions() {
  const idSelect = $("id-select");
  const current = idSelect.value;
  idSelect.innerHTML = "";
  Object.keys(studentDB[$("class-select").value] || {}).forEach((id) => idSelect.add(new Option(`${id} 號`, id)));
  if ([...idSelect.options].some((option) => option.value === current)) idSelect.value = current;
}

function updateStudentPreview() {
  const className = $("class-select").value;
  const id = $("id-select").value;
  $("student-name-display").textContent = studentDB[className]?.[id] || "請選擇班別與學號";
}

async function login() {
  const className = $("class-select").value;
  const id = Number($("id-select").value);
  const name = studentDB[className]?.[id];
  if (!name) return;
  player = { className, id, name };
  const button = $("login-button");
  button.disabled = true;
  $("login-status").textContent = "正在讀取課堂進度...";
  try {
    progress = loadProgress();
    if (API_URL) {
      const response = await fetch(`${API_URL}?action=loadRationalPlayer&className=${encodeURIComponent(className)}&id=${id}&t=${Date.now()}`);
      if (!response.ok) throw new Error("Unable to load progress");
      const data = await response.json();
      if (data.player) progress = { ...defaultProgress(), ...data.player };
    }
    $("player-class").textContent = `${className} ${id} 號`;
    $("player-name").textContent = name;
    $("login-screen").classList.add("hidden");
    updateProgressUI();
    nextQuestion();
  } catch (error) {
    console.error(error);
    $("login-status").textContent = "暫時未能連接課堂資料，請稍後重試。";
    button.disabled = false;
  }
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
  progress.mistakes = correct ? 0 : (Number(progress.mistakes) || 0) + 1;
  pendingDamage += correct ? 45 : 0;
  pendingAnswers.push({
    level: question.level,
    question: question.tex,
    studentAnswer: entry,
    correctAnswer: question.answer.toFraction(),
    isCorrect: correct,
  });
  saveProgress();
  scheduleSync();
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
  progress = defaultProgress();
  saveProgress();
  pendingAnswers = [];
  pendingDamage = 0;
  scheduleSync();
  questionNumber = 0;
  $("reset-dialog").close();
  updateProgressUI();
  nextQuestion();
}

function scheduleSync() {
  syncQueued = true;
  if (!syncInFlight) flushSyncQueue();
}

async function flushSyncQueue() {
  if (syncInFlight || !syncQueued || !player) return;
  syncInFlight = true;
  syncQueued = false;
  const answers = pendingAnswers.splice(0);
  const addedDamage = pendingDamage;
  pendingDamage = 0;
  const payload = { ...player, ...progress, addedDamage, answers };
  if (!API_URL) {
    syncInFlight = false;
    return;
  }
  try {
    await fetch(`${API_URL}?action=saveRational`, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(JSON.stringify(payload))}`,
    });
  } catch (error) {
    pendingDamage += addedDamage;
    pendingAnswers.unshift(...answers);
    console.error("Sync failed", error);
  } finally {
    syncInFlight = false;
    if (syncQueued || pendingAnswers.length || pendingDamage) window.setTimeout(flushSyncQueue, 250);
  }
}

document.addEventListener("DOMContentLoaded", init);
