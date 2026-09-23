import { getApiBase, getSession } from "./api.js";

const DISPLAY_KEY = "engage_dashboard_display_settings";
const TARGETS = {
  Conversation: "conversation",
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

function removeComparisonLines(card) {
  if (!card) return;
  card.querySelectorAll(".engage-db-comparison").forEach((node) => node.remove());
  [...card.querySelectorAll("div")].forEach((node) => {
    if (node.classList.contains("engage-db-comparison")) return;
    const text = (node.textContent || "").replace(/\s+/g, " ").trim();
    if (/^(↑ New|↑ \d+%|↓ \d+%|— Same)\s+vs last (week|month)$/.test(text)) {
      node.remove();
    }
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

function render() {
  renderQueued = false;
  cleanAllComparisonCards();

  const display = settings();
  if (display.showComparisons === false || !latest) return;
  if (latest.period !== (display.comparisonPeriod || "weekly")) return;
  if (latest.salesmanId !== dashboardEmployee()) return;

  Object.entries(TARGETS).forEach(([label, key]) => {
    appendLine(visibleCard(label), latest.comparisons?.[key], latest.period);
  });
}

function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(render);
}

async function refresh() {
  const display = settings();
  cleanAllComparisonCards();
  if (display.showComparisons === false) {
    latest = null;
    return;
  }

  const base = getApiBase();
  const token = getSession()?.token;
  if (!base || !token) return;

  const period = display.comparisonPeriod === "monthly" ? "monthly" : "weekly";
  const salesmanId = dashboardEmployee();
  const params = new URLSearchParams({ period });
  if (salesmanId !== "all") params.set("salesmanId", salesmanId);

  try {
    const response = await fetch(`${base}/admin/dashboard-comparisons?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return;
    const data = await response.json();
    latest = { ...data, salesmanId };
    queueRender();
  } catch {
    // Keep the dashboard usable if the comparison request is unavailable.
  }
}

function install() {
  if (observer) return;

  observer = new MutationObserver(queueRender);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("engage-display-settings", refresh);
  document.addEventListener("change", (event) => {
    if (event.target?.matches?.('select[aria-label="Dashboard employee"]')) refresh();
  });

  // Initial render after the app has mounted and restored its session.
  setTimeout(refresh, 0);
}

install();
