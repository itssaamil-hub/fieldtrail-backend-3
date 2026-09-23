import { getApiBase, getSession } from "./api.js";

const DISPLAY_KEY = "engage_dashboard_display_settings";
const CACHE_KEY = "engage_dashboard_comparison_cache_v1";
const COMPARISON_TARGETS = {
  Conversation: "conversation",
  "In Negotiation": "negotiation",
  "Total Leads": "total",
  Won: "won",
};
const METRIC_TARGETS = {
  Conversation: "conversation",
  "Leads Today": "leadsToday",
  "Hot Leads": "hotToday",
  "In Negotiation": "negotiation",
  "Total Leads": "total",
  Won: "won",
};
const ALL_COMPARISON_CARDS = [
  "Conversation",
  "Leads Today",
  "Hot Leads",
  "In Negotiation",
  "Total Leads",
  "Won",
];

let latest = null;
let observer = null;
let renderQueued = false;
let observing = false;
let refreshTimer = null;
let requestId = 0;

function settings() {
  try {
    return {
      showComparisons: true,
      comparisonPeriod: "weekly",
      ...JSON.parse(localStorage.getItem(DISPLAY_KEY) || "{}"),
    };
  } catch {
    return { showComparisons: true, comparisonPeriod: "weekly" };
  }
}

function readCachedLatest() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (!cached || !cached.metrics || !cached.comparisons || !cached.period) return null;
    return cached;
  } catch {
    return null;
  }
}

function writeCachedLatest(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Cache is only a fast-display fallback; dashboard still works without it.
  }
}

function dashboardEmployee() {
  return document.querySelector('select[aria-label="Dashboard employee"]')?.value || "all";
}

function visibleCard(label) {
  const cards = [...document.querySelectorAll(".ft-card")];
  return cards.find((card) => {
    const text = (card.textContent || "").replace(/\s+/g, " ").trim();
    if (label === "Hot Leads") return text.startsWith("Hot Leads");
    return text.startsWith(label);
  }) || null;
}

function valueNode(card) {
  if (!card) return null;
  return [...card.children].find((node) => node?.style?.fontSize === "24px") || null;
}

function setCardValue(label, value) {
  const node = valueNode(visibleCard(label));
  if (node && value != null) node.textContent = String(value);
}

function formatMoney(n) {
  const value = Number(n || 0);
  if (value >= 1e7) return `₹${(value / 1e7).toFixed(1)}Cr`;
  if (value >= 1e5) return `₹${(value / 1e5).toFixed(1)}L`;
  if (value >= 1e3) return `₹${(value / 1e3).toFixed(1)}K`;
  return `₹${value.toLocaleString("en-IN")}`;
}

function setCardSub(label, text) {
  const card = visibleCard(label);
  const value = valueNode(card);
  if (!card || !value) return;

  const children = [...card.children];
  const valueIndex = children.indexOf(value);
  let sub = children.slice(valueIndex + 1).find((node) =>
    node.tagName === "DIV" &&
    !node.classList.contains("engage-db-comparison") &&
    !node.classList.contains("engage-db-sub")
  );

  if (!text) {
    card.querySelectorAll(".engage-db-sub").forEach((node) => node.remove());
    if (sub) sub.textContent = "";
    return;
  }

  if (!sub) sub = card.querySelector(":scope > .engage-db-sub");
  if (!sub) {
    sub = document.createElement("div");
    sub.className = "engage-db-sub";
    sub.style.fontSize = "11px";
    sub.style.color = "#6B7280";
    sub.style.marginTop = "2px";
    value.insertAdjacentElement("afterend", sub);
  }
  sub.textContent = text;
}

function applyExactMetrics() {
  if (!latest?.metrics) return;
  if (latest.salesmanId !== dashboardEmployee()) return;

  Object.entries(METRIC_TARGETS).forEach(([label, key]) => {
    setCardValue(label, latest.metrics[key]);
  });

  setCardSub("Total Leads", `${latest.metrics.pending} pending`);
  setCardSub("Won", latest.metrics.wonValue > 0 ? `${formatMoney(latest.metrics.wonValue)} closed` : "");
}

function removeComparisonLines(card) {
  if (!card) return;
  card.querySelectorAll(".engage-db-comparison").forEach((node) => node.remove());
  [...card.querySelectorAll("div")].forEach((node) => {
    if (node.classList.contains("engage-db-comparison")) return;
    const text = (node.textContent || "").replace(/\s+/g, " ").trim();
    if (/^(↑ New|↑ \d+%|↓ \d+%|— Same)\s+vs last (week|month)$/.test(text)) node.remove();
  });
}

function cleanAllComparisonCards() {
  ALL_COMPARISON_CARDS.forEach((label) => removeComparisonLines(visibleCard(label)));
}

function lineText(comparison, period) {
  const pct = comparison?.pct;
  const prefix = pct == null
    ? "↑ New"
    : pct > 0
      ? `↑ ${pct}%`
      : pct < 0
        ? `↓ ${Math.abs(pct)}%`
        : "— Same";
  return `${prefix} vs last ${period === "monthly" ? "month" : "week"}`;
}

function lineColor(comparison) {
  const pct = comparison?.pct;
  if (pct == null || pct > 0) return "#12805C";
  if (pct < 0) return "#C0392B";
  return "#6B7280";
}

function appendLine(card, comparison, period) {
  if (!card || !comparison) return;
  const line = document.createElement("div");
  line.className = "engage-db-comparison";
  line.style.fontSize = "9.8px";
  line.style.marginTop = "4px";
  line.style.fontWeight = "700";
  line.style.color = lineColor(comparison);
  line.style.whiteSpace = "nowrap";

  const text = lineText(comparison, period);
  const suffix = `vs last ${period === "monthly" ? "month" : "week"}`;
  const prefix = text.slice(0, text.length - suffix.length).trimEnd();
  line.append(document.createTextNode(`${prefix} `));

  const sub = document.createElement("span");
  sub.style.fontWeight = "500";
  sub.style.color = "#6B7280";
  sub.textContent = suffix;
  line.appendChild(sub);
  card.appendChild(line);
}

function startObserving() {
  if (!observer || observing) return;
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  observing = true;
}

function stopObserving() {
  if (!observer || !observing) return;
  observer.disconnect();
  observing = false;
}

function render() {
  renderQueued = false;
  stopObserving();
  try {
    const display = settings();

    // OFF must always remove comparisons immediately.
    if (display.showComparisons === false) {
      cleanAllComparisonCards();
      applyExactMetrics();
      return;
    }

    // Keep existing comparison lines while fresh data is unavailable. Once we
    // have a matching cached/fresh payload, replace them with the exact values.
    applyExactMetrics();
    if (!latest) return;
    if (latest.period !== (display.comparisonPeriod || "weekly")) return;
    if (latest.salesmanId !== dashboardEmployee()) return;

    cleanAllComparisonCards();
    Object.entries(COMPARISON_TARGETS).forEach(([label, key]) => {
      appendLine(visibleCard(label), latest.comparisons?.[key], latest.period);
    });
  } finally {
    startObserving();
  }
}

function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(render);
}

function scheduleRefresh(delay = 700) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refresh, delay);
}

async function refresh() {
  const display = settings();
  queueRender();

  const base = getApiBase();
  const token = getSession()?.token;
  if (!base || !token) return;

  const period = display.comparisonPeriod === "monthly" ? "monthly" : "weekly";
  const salesmanId = dashboardEmployee();
  const params = new URLSearchParams({ period });
  if (salesmanId !== "all") params.set("salesmanId", salesmanId);
  const thisRequest = ++requestId;

  try {
    const response = await fetch(`${base}/admin/dashboard-comparisons?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return;
    const data = await response.json();
    if (thisRequest !== requestId) return;
    latest = { ...data, salesmanId };
    writeCachedLatest(latest);
    queueRender();
  } catch {
    // Cached data remains visible while Render wakes up or is temporarily down.
  }
}

function install() {
  if (observer) return;

  const cached = readCachedLatest();
  if (cached) latest = cached;

  observer = new MutationObserver(() => {
    queueRender();
    scheduleRefresh();
  });
  startObserving();

  window.addEventListener("engage-display-settings", () => {
    const display = settings();
    const cachedNow = readCachedLatest();
    if (cachedNow && cachedNow.period === (display.comparisonPeriod || "weekly") && cachedNow.salesmanId === dashboardEmployee()) {
      latest = cachedNow;
    }
    refresh();
  });
  window.addEventListener("focus", () => refresh());
  document.addEventListener("change", (event) => {
    if (event.target?.matches?.('select[aria-label="Dashboard employee"]')) {
      const cachedNow = readCachedLatest();
      latest = cachedNow?.salesmanId === dashboardEmployee() ? cachedNow : null;
      refresh();
    }
  });

  setTimeout(() => {
    queueRender();
    refresh();
  }, 0);
  setInterval(refresh, 60000);
}

install();
