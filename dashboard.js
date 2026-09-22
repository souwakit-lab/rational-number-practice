const API_URL = window.RATIONAL_CONFIG?.apiUrl || "";
const REFRESH_INTERVAL_MS = 8000;
let refreshTimer;
let refreshInFlight = false;
let refreshPending = false;
const $ = (id) => document.getElementById(id);

function initDashboard() {
  initQrCode();
  $("class-filter").addEventListener("change", refreshData);
  $("fullscreen-button").addEventListener("click", toggleFullscreen);
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
  const players = data.players || [];
  const totalAnswers = players.reduce((sum, player) => sum + Number(player.total || 0), 0);
  const totalCorrect = players.reduce((sum, player) => sum + Number(player.correct || 0), 0);
  const bossMaxHp = Number(data.bossMaxHp) || 12000;
  const bossHp = Math.max(0, Number(data.bossHp) || 0);
  $("boss-copy").textContent = `${Math.round(bossHp).toLocaleString("zh-Hant")} / ${bossMaxHp.toLocaleString("zh-Hant")}`;
  $("boss-bar").style.width = `${Math.min(100, (bossHp / bossMaxHp) * 100)}%`;
  $("stat-players").textContent = players.length;
  $("stat-answers").textContent = totalAnswers.toLocaleString("zh-Hant");
  $("stat-accuracy").textContent = totalAnswers ? `${Math.round(totalCorrect / totalAnswers * 100)}%` : "--";
  $("updated-at").textContent = `更新 ${new Date().toLocaleTimeString("zh-Hant", { hour:"2-digit", minute:"2-digit", second:"2-digit" })}`;
  renderTiers(players);
  renderRanking("xp-list", [...players].sort((a,b) => totalXp(b) - totalXp(a)), (player) => totalXp(player));
  renderRanking("streak-list", [...players].sort((a,b) => b.streak - a.streak), (player) => player.streak);
  renderRanking("accuracy-list", players.filter((player) => player.total >= 3).sort((a,b) => b.accuracy - a.accuracy || b.total - a.total), (player) => `${Math.round(player.accuracy * 100)}%`);
  renderWarnings(players);
}

function renderTiers(players) {
  const counts = [1,2,3].map((level) => players.filter((player) => Number(player.level) === level).length);
  const max = Math.max(1, ...counts);
  counts.forEach((count,index) => {
    $(`tier-${index + 1}-count`).textContent = count;
    $(`tier-${index + 1}-bar`).style.width = `${count / max * 100}%`;
  });
}

function totalXp(player) { return (Math.max(1, Number(player.level)) - 1) * 300 + Number(player.xp || 0); }

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
document.addEventListener("DOMContentLoaded", initDashboard);
