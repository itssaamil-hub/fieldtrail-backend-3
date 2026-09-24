import { api } from "./api.js";

let pending = null;
let dueToday = null;
let observer = null;
let queued = false;
let timer = null;

function isVisible(node) {
  if (!node || !node.isConnected || node.closest("[hidden]")) return false;
  const style = window.getComputedStyle(node);
  return style.display !== "none" && style.visibility !== "hidden" && node.getClientRects().length > 0;
}

function findCard(label) {
  return [...document.querySelectorAll(".ft-card")].filter(isVisible).find((card) => {
    const text = (card.textContent || "").replace(/\s+/g, " ").trim();
    return text.startsWith(label);
  }) || null;
}

function hideLegacyTeamTasksEntry() {
  [...document.querySelectorAll("button.ft-task-entry")].forEach((button) => {
    const text = (button.textContent || "").replace(/\s+/g, " ").trim();
    if (!text.startsWith("Team Tasks")) return;
    button.style.display = "none";
    const error = button.nextElementSibling;
    if (error?.classList?.contains("ft-task-muted") && /could not refresh tasks/i.test(error.textContent || "")) {
      error.style.display = "none";
    }
  });
}

function taskCard() {
  return document.querySelector(".engage-task-kpi");
}

function openTasks() {
  const button = [...document.querySelectorAll('button[aria-label="Tasks"]')].find(isVisible);
  button?.click();
}

function styleCard(card) {
  const desktop = window.matchMedia("(min-width: 900px)").matches;
  card.style.background = "#fff";
  card.style.border = "1px solid #E7E9EE";
  card.style.boxSizing = "border-box";
  card.style.cursor = "pointer";
  card.style.overflow = "hidden";
  card.style.boxShadow = "0 1px 2px rgba(20,20,30,0.04)";
  card.style.transition = "transform 0.15s ease, box-shadow 0.15s ease";
  card.style.flex = desktop ? "1 1 205px" : "1";
  card.style.minWidth = desktop ? "205px" : "96px";
  card.style.minHeight = desktop ? "100px" : "";
  card.style.padding = desktop ? "10px 20px 9px" : "14px 16px";
  card.style.borderRadius = desktop ? "16px" : "14px";
}

function createCard() {
  const card = document.createElement("div");
  card.className = "ft-card engage-task-kpi";
  card.setAttribute("role", "button");
  card.setAttribute("tabindex", "0");
  card.setAttribute("aria-label", "Open Tasks");
  card.addEventListener("click", openTasks);
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openTasks();
    }
  });

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.gap = "9px";
  header.style.marginBottom = "5px";

  const title = document.createElement("div");
  title.textContent = "Tasks";
  title.style.fontSize = "10.5px";
  title.style.color = "#6B7280";
  title.style.fontWeight = "750";
  title.style.textTransform = "uppercase";
  title.style.letterSpacing = ".3px";

  const icon = document.createElement("span");
  icon.style.width = "26px";
  icon.style.height = "26px";
  icon.style.display = "inline-flex";
  icon.style.alignItems = "center";
  icon.style.justifyContent = "center";
  icon.style.color = "#145C5D";
  icon.style.flexShrink = "0";
  icon.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5h6M8.5 10h7M8.5 14h5"/></svg>';
  header.append(title, icon);

  const value = document.createElement("div");
  value.className = "engage-task-kpi-value";
  value.style.fontFamily = "'Space Grotesk', sans-serif";
  value.style.fontSize = "30px";
  value.style.lineHeight = "1.08";
  value.style.fontWeight = "700";
  value.style.color = "#145C5D";
  value.textContent = pending == null ? "—" : String(pending);

  const sub = document.createElement("div");
  sub.className = "engage-task-kpi-sub";
  sub.style.fontSize = "12px";
  sub.style.color = "#6B7280";
  sub.style.marginTop = "1px";
  sub.textContent = dueToday == null ? "pending tasks" : `${dueToday} due today`;

  card.append(header, value, sub);
  styleCard(card);
  return card;
}

function render() {
  queued = false;
  hideLegacyTeamTasksEntry();

  const desktop = window.matchMedia("(min-width: 900px)").matches;
  if (!desktop) {
    taskCard()?.remove();
    return;
  }

  const won = findCard("Won");
  if (!won?.parentElement) return;

  let card = taskCard();
  if (!card) {
    card = createCard();
    won.insertAdjacentElement("afterend", card);
  }

  styleCard(card);
  const value = card.querySelector(".engage-task-kpi-value");
  const sub = card.querySelector(".engage-task-kpi-sub");
  if (value) value.textContent = pending == null ? "—" : String(pending);
  if (sub) sub.textContent = dueToday == null ? "pending tasks" : `${dueToday} due today`;
}

function queueRender() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(render);
}

async function refresh() {
  try {
    const [all, today] = await Promise.all([
      api.tasks({ filter: "all" }),
      api.tasks({ filter: "today" }),
    ]);
    pending = Number.isFinite(Number(all?.pending)) ? Number(all.pending) : 0;
    dueToday = (today?.tasks || []).filter((task) => task.status !== "completed").length;
  } catch {
    // Keep the last known numbers if the backend is temporarily unavailable.
  }
  queueRender();
}

function install() {
  if (observer) return;
  observer = new MutationObserver(queueRender);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("resize", queueRender);
  window.addEventListener("focus", refresh);
  window.addEventListener("fieldtrail:tasks", refresh);
  setTimeout(() => { queueRender(); refresh(); }, 0);
  timer = setInterval(refresh, 60000);
}

install();
