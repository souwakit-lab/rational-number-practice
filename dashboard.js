const API_URL = window.RATIONAL_CONFIG?.apiUrl || "";
const REFRESH_INTERVAL_MS = 8000;
let refreshTimer;
let refreshInFlight = false;
let refreshPending = false;
let latestData = { players: [], bossHp: 0, bossMaxHp: 50000 };
let toastTimer;
const $ = (id) => document.getElementById(id);

function initDashboard() {
  initQrCode();
  $("class-filter").addEventListener("change", refreshData);
  $("fullscreen-button").addEventListener("click", toggleFullscreen);
  $("download-data-button").addEventListener("click", downloadData);
  $("download-report-button").addEventListener("click", downloadReport);
  $("reset-data-button").addEventListener("click", openResetDialog);
  $("confirm-reset-button").addEventListener("click", resetData);
  document.addEventListener("fullscreenchange", updateFullscreenButton);
  if (window.lucide) lucide.createIcons();
  refreshData();
  startRefreshTimer();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) window.clearInterval(refreshTimer);
    else { refreshData(); startRefreshTimer(); }
  });
}

function startRefreshTimer() {
  window.clearInterval(refreshTimer);
  refreshTimer = window.setInterval(refreshData, REFRESH_INTERVAL_MS);
}

function initQrCode() {
  const studentUrl = window.RATIONAL_CONFIG?.studentUrl || new URL("index.html", location.href).href;
  $("student-link").href = studentUrl;
  if (window.QRCode) new QRCode($("join-qr"), { text: studentUrl, width: 180, height: 180, colorDark: "#0d1524", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.M });
}

async function refreshData() {
  if (refreshInFlight) { refreshPending = true; return; }
  refreshInFlight = true;
  const className = $("class-filter").value;
  try {
    const response = await fetch(`${API_URL}?action=getRationalDashboardData&className=${encodeURIComponent(className)}&t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load dashboard");
    renderDashboard(await response.json());
  } catch (error) {
    console.error(error);
    $("updated-at").textContent = "資料連線中斷";
  } finally {
    refreshInFlight = false;
    if (refreshPending) { refreshPending = false; refreshData(); }
  }
}

function renderDashboard(data) {
  latestData = data;
  const players = data.players || [];
  const totalAnswers = players.reduce((sum, player) => sum + Number(player.total || 0), 0);
  const totalCorrect = players.reduce((sum, player) => sum + Number(player.correct || 0), 0);
  const bossMaxHp = Number(data.bossMaxHp) || 50000;
  const bossHp = Math.max(0, Number(data.bossHp) || 0);
  $("boss-copy").textContent = `${Math.round(bossHp).toLocaleString("zh-Hant")} / ${bossMaxHp.toLocaleString("zh-Hant")}`;
  $("boss-bar").style.width = `${Math.min(100, (bossHp / bossMaxHp) * 100)}%`;
  $("stat-players").textContent = players.length;
  $("stat-answers").textContent = totalAnswers.toLocaleString("zh-Hant");
  $("stat-accuracy").textContent = totalAnswers ? `${Math.round(totalCorrect / totalAnswers * 100)}%` : "--";
  $("updated-at").textContent = `更新 ${new Date().toLocaleTimeString("zh-Hant", { hour:"2-digit", minute:"2-digit", second:"2-digit" })}`;
  renderTiers(players, data.levelStats || []);
  renderRanking("xp-list", [...players].sort((a,b) => totalXp(b) - totalXp(a)), (player) => totalXp(player));
  renderRanking("streak-list", [...players].sort((a,b) => b.streak - a.streak), (player) => player.streak);
  renderRanking("accuracy-list", players.filter((player) => player.total >= 3).sort((a,b) => b.accuracy - a.accuracy || b.total - a.total), (player) => `${Math.round(player.accuracy * 100)}%`);
  renderWarnings(players);
}

function renderTiers(players, levelStats) {
  const counts = [1,2,3,4].map((level) => players.filter((player) => Number(player.level) === level).length);
  const max = Math.max(1, ...counts);
  counts.forEach((count,index) => {
    const stats = levelStats.find((item) => Number(item.level) === index + 1) || { total:0, accuracy:0 };
    const total = Number(stats.total || 0);
    const correct = Number(stats.correct || 0);
    $(`tier-${index + 1}-count`).textContent = count;
    $(`tier-${index + 1}-stats`).textContent = `${total.toLocaleString("zh-Hant")} 題 · 對 ${correct.toLocaleString("zh-Hant")} · 錯 ${Math.max(0, total - correct).toLocaleString("zh-Hant")} · ${total ? `${Math.round(Number(stats.accuracy || 0) * 100)}%` : "--"}`;
    $(`tier-${index + 1}-bar`).style.width = `${count / max * 100}%`;
  });
}

function totalXp(player) { return (Math.max(1, Number(player.level)) - 1) * 500 + Number(player.xp || 0); }

function renderRanking(id, players, valueFormatter) {
  const top = players.slice(0, 6);
  $(id).innerHTML = top.length ? top.map((player,index) => `<li><span class="rank">${index + 1}</span><span>${escapeHtml(player.name)} <small>Lv.${player.level}</small></span><span class="value">${valueFormatter(player)}</span></li>`).join("") : '<li class="empty-row">尚未有學生數據</li>';
}

function renderWarnings(players) {
  const warnings = players.filter((player) => Number(player.mistakes) >= 3 || (Number(player.total) >= 5 && Number(player.accuracy) < .6));
  $("warning-list").innerHTML = warnings.length ? warnings.map((player) => `<div class="warning-item"><strong>${escapeHtml(player.name)}</strong><span>${player.mistakes >= 3 ? `連錯 ${player.mistakes} 題` : `正確率 ${Math.round(player.accuracy * 100)}%`}</span></div>`).join("") : '<div class="warning-clear">目前沒有需要支援的學生</div>';
}

function escapeHtml(value) { const node = document.createElement("span"); node.textContent = value || "未命名"; return node.innerHTML; }
function toggleFullscreen() { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); }

function updateFullscreenButton() {
  const button = $("fullscreen-button");
  button.innerHTML = `<i data-lucide="${document.fullscreenElement ? "minimize" : "maximize"}"></i>`;
  button.title = document.fullscreenElement ? "退出全螢幕" : "全螢幕";
  button.setAttribute("aria-label", button.title);
  if (window.lucide) lucide.createIcons();
}

function selectedScopeLabel() { return $("class-filter").value || "全校"; }

function openResetDialog() {
  $("reset-dialog-copy").textContent = `這會清除${selectedScopeLabel()}的學生進度、作答紀錄，並回復首領能量。此操作無法復原。`;
  $("reset-dialog").showModal();
}

async function resetData() {
  const button = $("confirm-reset-button");
  button.disabled = true;
  button.textContent = "重置中...";
  const payload = { className: $("class-filter").value };
  try {
    await fetch(`${API_URL}?action=resetRational`, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(JSON.stringify(payload))}`,
    });
    $("reset-dialog").close();
    showToast(`${selectedScopeLabel()}數據已重置`);
    window.setTimeout(refreshData, 800);
  } catch (error) {
    console.error(error);
    showToast("重置失敗，請檢查網絡後重試");
  } finally {
    button.disabled = false;
    button.textContent = "確認重置";
  }
}

async function downloadData() {
  const button = $("download-data-button");
  button.disabled = true;
  try {
    const className = $("class-filter").value;
    const response = await fetch(`${API_URL}?action=getRationalExportData&className=${encodeURIComponent(className)}&t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to export data");
    const data = await response.json();
    const rows = [["時間","班別","學號","姓名","程度","題目","學生答案","正確答案","是否正確"]];
    data.answers.forEach((answer) => rows.push([answer.timestamp,answer.className,answer.id,answer.name,answer.level,answer.question,answer.studentAnswer,answer.correctAnswer,answer.isCorrect ? "是" : "否"]));
    downloadBlob(`有理數作答數據_${fileStamp()}_${selectedScopeLabel()}.csv`, `\ufeff${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`, "text/csv;charset=utf-8");
    showToast(`已下載 ${data.answers.length} 筆作答數據`);
  } catch (error) {
    console.error(error);
    showToast("下載失敗，請檢查網絡後重試");
  } finally {
    button.disabled = false;
  }
}

function downloadReport() {
  const players = latestData.players || [];
  const totalAnswers = players.reduce((sum, player) => sum + Number(player.total || 0), 0);
  const totalCorrect = players.reduce((sum, player) => sum + Number(player.correct || 0), 0);
  const sorted = [...players].sort((a,b) => totalXp(b) - totalXp(a));
  const tableRows = sorted.map((player,index) => `<tr><td>${index + 1}</td><td>${escapeHtml(player.className)}</td><td>${player.id}</td><td>${escapeHtml(player.name)}</td><td>${player.level}</td><td>${totalXp(player)}</td><td>${player.total}</td><td>${Math.round(Number(player.accuracy || 0) * 100)}%</td><td>${player.streak}</td></tr>`).join("");
  const html = `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>有理數學習報表</title><style>body{font-family:Arial,"Noto Sans TC",sans-serif;color:#172033;margin:36px}h1{margin-bottom:4px}.meta{color:#667085;margin-bottom:24px}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:20px 0}.metric{border:1px solid #d7dce5;padding:14px}.metric b{display:block;font-size:24px;margin-top:6px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #d7dce5;padding:8px;text-align:left}th{background:#edf1f7}@media print{body{margin:16px}.metrics{break-inside:avoid}}</style><body><h1>有理數加減學習報表</h1><div class="meta">範圍：${escapeHtml(selectedScopeLabel())}｜產生時間：${new Date().toLocaleString("zh-Hant")}</div><div class="metrics"><div class="metric">參與學生<b>${players.length}</b></div><div class="metric">總作答<b>${totalAnswers}</b></div><div class="metric">整體正確率<b>${totalAnswers ? Math.round(totalCorrect / totalAnswers * 100) : 0}%</b></div><div class="metric">首領能量<b>${Math.round(Number(latestData.bossHp || 0))} / ${Math.round(Number(latestData.bossMaxHp || 0))}</b></div></div><table><thead><tr><th>排名</th><th>班別</th><th>學號</th><th>姓名</th><th>程度</th><th>累積 XP</th><th>作答數</th><th>正確率</th><th>連勝</th></tr></thead><tbody>${tableRows || '<tr><td colspan="9">尚未有學生數據</td></tr>'}</tbody></table></body></html>`;
  downloadBlob(`有理數學習報表_${fileStamp()}_${selectedScopeLabel()}.html`, html, "text/html;charset=utf-8");
  showToast("統計報表已下載，可用瀏覽器開啟或列印為 PDF");
}

function csvCell(value) { return `"${String(value ?? "").replaceAll('"','""')}"`; }
function fileStamp() { return new Date().toISOString().slice(0,10); }
function downloadBlob(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function showToast(message) {
  const toast = $("dashboard-toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
}
document.addEventListener("DOMContentLoaded", initDashboard);
