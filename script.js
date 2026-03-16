const navToggle = document.getElementById("navToggle");
const nav = document.querySelector(".nav");

if (navToggle && nav) {
  navToggle.addEventListener("click", () => {
    nav.classList.toggle("show");
  });
}

const yearSpan = document.getElementById("year");
if (yearSpan) {
  yearSpan.textContent = new Date().getFullYear();
}

function safeText(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function formatNumber(n) {
  if (typeof n !== "number") return safeText(n);
  return new Intl.NumberFormat("zh-CN").format(n);
}

async function fetchUmamiSummary() {
  const base = safeText(window.UMAMI_PROXY_URL || "").trim().replace(/\/+$/, "");
  if (!base) return { ok: false, error: "尚未配置 UMAMI_PROXY_URL" };

  const url = `${base}/summary`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `请求失败：${res.status} ${text}`.trim() };
  }

  const data = await res.json();
  return { ok: true, data };
}

function animateNumber(el, toValue) {
  if (!el) return;
  const to = typeof toValue === "number" ? toValue : Number(toValue) || 0;
  const from = 0;
  const duration = 900;
  const start = performance.now();

  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const current = Math.round(from + (to - from) * eased);
    el.textContent = formatNumber(current);
    if (t < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

function renderStats(data) {
  const root = document.getElementById("visit-stats");
  if (!root) return;

  const totals = (data && data.totals) || {};
  const last7d = (data && data.last7d) || {};

  const cards = `
    <div class="stats-hero">
      <div class="stats-hero-card">
        <div class="stats-label">总浏览量</div>
        <div class="stats-value stats-value-lg" data-anim="pageviews">${formatNumber(0)}</div>
      </div>
      <div class="stats-hero-card">
        <div class="stats-label">总访客数</div>
        <div class="stats-value stats-value-lg" data-anim="visitors">${formatNumber(0)}</div>
      </div>
      <div class="stats-mini">
        <div class="stats-mini-item">
          <span class="stats-mini-k">最近 7 天浏览量</span>
          <span class="stats-mini-v">${formatNumber(last7d.pageviews ?? 0)}</span>
        </div>
        <div class="stats-mini-item">
          <span class="stats-mini-k">最近 7 天访客数</span>
          <span class="stats-mini-v">${formatNumber(last7d.visitors ?? 0)}</span>
        </div>
      </div>
    </div>
  `;

  const countries = (last7d.topCountries || [])
    .slice(0, 8)
    .map(
      (x) => `
        <li>
          <span class="dot"></span>
          <span class="stats-item-key">${safeText(x.name || x.country || "Unknown")}</span>
          <span class="stats-item-val">${formatNumber(x.value ?? x.count ?? "")}</span>
        </li>`
    )
    .join("");

  const referrers = (last7d.topReferrers || [])
    .slice(0, 8)
    .map(
      (x) => `
        <li>
          <span class="dot"></span>
          <span class="stats-item-key">${safeText(x.name || x.referrer || "Direct")}</span>
          <span class="stats-item-val">${formatNumber(x.value ?? x.count ?? "")}</span>
        </li>`
    )
    .join("");

  root.innerHTML = `
    ${cards}
    <div class="stats-lists">
      <div class="stats-list card">
        <h3>近 7 天 · Top Countries</h3>
        <ul class="stats-ul">${countries || `<li class="stats-empty">暂无数据</li>`}</ul>
      </div>
      <div class="stats-list card">
        <h3>近 7 天 · Top Referrers</h3>
        <ul class="stats-ul">${referrers || `<li class="stats-empty">暂无数据</li>`}</ul>
      </div>
    </div>
  `;

  animateNumber(root.querySelector('[data-anim="pageviews"]'), totals.pageviews ?? 0);
  animateNumber(root.querySelector('[data-anim="visitors"]'), totals.visitors ?? 0);
}

async function initUmamiStats() {
  const root = document.getElementById("visit-stats");
  if (!root) return;

  try {
    const result = await fetchUmamiSummary();
    if (!result.ok) {
      root.innerHTML = `<div class="stats-error">统计不可用：${safeText(result.error)}</div>`;
      return;
    }
    renderStats(result.data || {});
  } catch (e) {
    root.innerHTML = `<div class="stats-error">统计加载失败：${safeText(e && e.message ? e.message : e)}</div>`;
  }
}

initUmamiStats();
