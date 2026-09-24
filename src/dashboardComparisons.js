import { getApiBase, getSession } from "./api.js";

const DISPLAY_KEY = "engage_dashboard_display_settings";
const CACHE_KEY = "engage_dashboard_comparison_cache_v2";
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
const ALL_COMPARISON_CARDS = ["Conversation", "Leads Today", "Hot Leads", "In Negotiation", "Total Leads", "Won"];

let latest = null;
let observer = null;
let renderQueued = false;
let observing = false;
let refreshTimer = null;
let requestId = 0;

function settings() {
  try {
    return { showComparisons: true, comparisonPeriod: "weekly", ...JSON.parse(localStorage.getItem(DISPLAY_KEY) || "{}") };
  } catch {
    return { showComparisons: true, comparisonPeriod: "weekly" };
  }
}

function readCachedLatest() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    return cached && cached.comparisons && cached.period ? cached : null;
  } catch {
    return null;
  }
}

function writeCachedLatest(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
}

function dashboardEmployee() {
  return document.querySelector('select[aria-label="Dashboard employee"]')?.value || "all";
}

function desktopCards() {
  return window.matchMedia("(min-width: 900px)").matches;
}

function isActuallyVisible(node) {
  if (!node || !node.isConnected || node.closest('[hidden]')) return false;
  const style = window.getComputedStyle(node);
  return style.display !== "none" && style.visibility !== "hidden" && node.getClientRects().length > 0;
}

function visibleCard(label) {
  return [...document.querySelectorAll(".ft-card")].filter(isActuallyVisible).find((card) => {
    const text = (card.textContent || "").replace(/\s+/g, " ").trim();
    if (label === "Hot Leads") return text.startsWith("Hot Leads");
    return text.startsWith(label);
  }) || null;
}

function valueNode(card) {
  if (!card) return null;
  return [...card.children].find((node) => {
    const family = node?.style?.fontFamily || "";
    return node?.classList?.contains("engage-db-value") || family.includes("Space Grotesk") || node?.style?.fontSize === "24px" || node?.style?.fontSize === "30px";
  }) || null;
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
  let sub = card.querySelector(":scope > .engage-db-sub");
  if (!text || !desktopCards()) {
    sub?.remove();
    return;
  }
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
  if (!latest?.metrics || latest.salesmanId !== dashboardEmployee()) return;
  Object.entries(METRIC_TARGETS).forEach(([label, key]) => setCardValue(label, latest.metrics[key]));
  setCardSub("Total Leads", `${latest.metrics.cold ?? 0} cold`);
  setCardSub("Won", latest.metrics.wonValue > 0 ? `${formatMoney(latest.metrics.wonValue)} closed` : "");
}

function removeComparisonLines(card) {
  if (!card) return;
  card.querySelectorAll(".engage-db-comparison").forEach((node) => node.remove());
}

function cleanAllComparisonCards() {
  ALL_COMPARISON_CARDS.forEach((label) => removeComparisonLines(visibleCard(label)));
}

function cleanDesktopOnlyDecoration() {
  cleanAllComparisonCards();
  document.querySelectorAll(".engage-db-sub").forEach((node) => node.remove());
}

function lineText(comparison, period) {
  const pct = comparison?.pct;
  const prefix = pct == null ? "↑ New" : pct > 0 ? `↑ ${pct}%` : pct < 0 ? `↓ ${Math.abs(pct)}%` : "— Same";
  return `${prefix} vs last ${period === "monthly" ? "month" : "week"}`;
}

function lineColor(comparison) {
  const pct = comparison?.pct;
  if (pct == null || pct > 0) return "#12805C";
  if (pct < 0) return "#C0392B";
  return "#6B7280";
}

function hasReactComparison(card, period) {
  if (!card) return false;
  const suffix = `vs last ${period === "monthly" ? "month" : "week"}`;
  return [...card.children].some((node) => {
    if (node.classList?.contains("engage-db-comparison")) return false;
    const text = (node.textContent || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    return text.includes(suffix) && /^(↑ New|↑ \d+%|↓ \d+%|— Same)/.test(text);
  });
}

function appendLine(card, comparison, period) {
  if (!desktopCards() || !card || !comparison || hasReactComparison(card, period)) return;
  const line = document.createElement("div");
  line.className = "engage-db-comparison";
  line.style.fontSize = "9.8px";
  line.style.marginTop = "4px";
  line.style.fontWeight = "700";
  line.style.color = lineColor(comparison);
  line.style.lineHeight = "1.25";
  line.style.maxWidth = "100%";
  line.style.paddingBottom = "2px";
  line.style.display = "flex";
  line.style.alignItems = "baseline";
  line.style.gap = "3px";
  line.style.flexWrap = "wrap";
  line.style.whiteSpace = "normal";
  const text = lineText(comparison, period);
  const suffix = `vs last ${period === "monthly" ? "month" : "week"}`;
  const prefix = text.slice(0, text.length - suffix.length).trimEnd();
  line.append(document.createTextNode(prefix));
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
    applyExactMetrics();

    // Phone keeps the native compact card UI. Only the exact KPI number is synced.
    if (!desktopCards()) {
      cleanDesktopOnlyDecoration();
      return;
    }

    if (display.showComparisons === false) {
      cleanAllComparisonCards();
      return;
    }
    if (!latest || latest.period !== (display.comparisonPeriod || "weekly") || latest.salesmanId !== dashboardEmployee()) return;
    cleanAllComparisonCards();
    Object.entries(COMPARISON_TARGETS).forEach(([label, key]) => appendLine(visibleCard(label), latest.comparisons?.[key], latest.period));
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

function periodBounds(period, previous = false) {
  const now = new Date();
  if (period === "monthly") {
    const y = now.getFullYear();
    const m = now.getMonth() - (previous ? 1 : 0);
    const start = new Date(y, m, 1);
    const maxDay = new Date(y, m + 1, 0).getDate();
    const end = previous ? new Date(y, m, Math.min(now.getDate(), maxDay), now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds()) : now;
    return [start, end];
  }
  const weekday = (now.getDay() + 6) % 7;
  const currentStart = new Date(now); currentStart.setHours(0, 0, 0, 0); currentStart.setDate(currentStart.getDate() - weekday);
  const start = new Date(currentStart); if (previous) start.setDate(start.getDate() - 7);
  const end = previous ? new Date(start.getTime() + (now.getTime() - currentStart.getTime())) : now;
  return [start, end];
}

function pct(current, previous) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

async function fallbackFromLeads(base, token, period, salesmanId) {
  const response = await fetch(`${base}/admin/leads`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) return null;
  const data = await response.json();
  let leads = data.leads || [];
  if (salesmanId !== "all") leads = leads.filter((l) => (l.salesmanId || l.salesman_id) === salesmanId);
  const [cs, ce] = periodBounds(period, false);
  const [ps, pe] = periodBounds(period, true);
  const createdAt = (l) => new Date(l.createdAt || l.created_at);
  const count = (start, end, status) => leads.filter((l) => {
    const d = createdAt(l);
    return d >= start && d <= end && (!status || l.status === status);
  }).length;
  const currentTotal = count(cs, ce);
  const previousTotal = count(ps, pe);
  const currentConversation = count(cs, ce, "conversation");
  const previousConversation = count(ps, pe, "conversation");
  const currentNegotiation = count(cs, ce, "negotiation");
  const previousNegotiation = count(ps, pe, "negotiation");
  const currentWon = count(cs, ce, "won");
  const previousWon = count(ps, pe, "won");
  const cold = leads.filter((l) => l.status === "cold").length;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const leadsToday = leads.filter((l) => createdAt(l) >= todayStart).length;
  const hotToday = leads.filter((l) => createdAt(l) >= todayStart && l.status === "hot").length;
  const wonValue = leads.filter((l) => l.status === "won").reduce((sum, l) => sum + Number(l.dealValue || l.deal_value || 0), 0);
  return {
    period,
    salesmanId,
    metrics: {
      total: leads.length,
      conversation: leads.filter((l) => l.status === "conversation").length,
      negotiation: leads.filter((l) => l.status === "negotiation").length,
      won: leads.filter((l) => l.status === "won").length,
      cold,
      leadsToday,
      hotToday,
      wonValue,
    },
    comparisons: {
      conversation: { current: currentConversation, previous: previousConversation, pct: pct(currentConversation, previousConversation) },
      negotiation: { current: currentNegotiation, previous: previousNegotiation, pct: pct(currentNegotiation, previousNegotiation) },
      total: { current: currentTotal, previous: previousTotal, pct: pct(currentTotal, previousTotal) },
      won: { current: currentWon, previous: previousWon, pct: pct(currentWon, previousWon) },
    },
  };
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
    const response = await fetch(`${base}/admin/dashboard-comparisons?${params}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      if (thisRequest !== requestId) return;
      latest = { ...data, salesmanId };
      writeCachedLatest(latest);
      queueRender();
      return;
    }
  } catch {}

  try {
    const fallback = await fallbackFromLeads(base, token, period, salesmanId);
    if (!fallback || thisRequest !== requestId) return;
    latest = fallback;
    writeCachedLatest(latest);
    queueRender();
  } catch {}
}

function install() {
  if (observer) return;
  // v2 cache intentionally ignores older dashboard totals after the live lead
  // status normalization migration.
  const cached = readCachedLatest();
  if (cached) latest = cached;
  observer = new MutationObserver(() => { queueRender(); scheduleRefresh(); });
  startObserving();
  window.addEventListener("engage-display-settings", refresh);
  window.addEventListener("focus", refresh);
  window.addEventListener("resize", queueRender);
  document.addEventListener("change", (event) => {
    if (event.target?.matches?.('select[aria-label="Dashboard employee"]')) {
      const cachedNow = readCachedLatest();
      latest = cachedNow?.salesmanId === dashboardEmployee() ? cachedNow : null;
      refresh();
    }
  });
  setTimeout(() => { queueRender(); refresh(); }, 0);
  setInterval(refresh, 60000);
}

install();
