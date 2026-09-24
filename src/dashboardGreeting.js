let observer = null;
let queued = false;

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

function greetingForHour(hour) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function dashboardTeamSelect() {
  return document.querySelector('select[aria-label="Dashboard employee"]');
}

function restoreTeamSelect() {
  const select = dashboardTeamSelect();
  if (!select?.__engageOriginalParent) return;

  const parent = select.__engageOriginalParent;
  const next = select.__engageOriginalNextSibling;
  if (next?.parentElement === parent) parent.insertBefore(select, next);
  else parent.appendChild(select);

  if (select.__engageOriginalCssText != null) select.style.cssText = select.__engageOriginalCssText;
  if (select.__engageOriginalRow) select.__engageOriginalRow.style.display = "";
}

function removeGreeting() {
  restoreTeamSelect();
  document.querySelectorAll(".engage-dashboard-greeting").forEach((node) => node.remove());
}

function createGreeting() {
  const row = document.createElement("div");
  row.className = "engage-dashboard-greeting";
  row.style.minHeight = "44px";
  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.justifyContent = "space-between";
  row.style.gap = "16px";
  row.style.padding = "0 2px";
  row.style.marginBottom = "8px";
  row.style.whiteSpace = "nowrap";
  row.style.overflow = "visible";

  const left = document.createElement("div");
  left.className = "engage-dashboard-greeting-copy";
  left.style.display = "flex";
  left.style.alignItems = "center";
  left.style.gap = "10px";
  left.style.minWidth = "0";
  left.style.overflow = "hidden";

  const primary = document.createElement("span");
  primary.className = "engage-dashboard-greeting-primary";
  primary.style.fontFamily = "'Space Grotesk', sans-serif";
  primary.style.fontSize = "20px";
  primary.style.lineHeight = "1.2";
  primary.style.fontWeight = "700";
  primary.style.letterSpacing = "-.25px";
  primary.style.color = "#1A1D23";
  primary.style.flexShrink = "0";

  const secondary = document.createElement("span");
  secondary.textContent = "A quick look at what needs your attention today.";
  secondary.style.fontSize = "13px";
  secondary.style.lineHeight = "1.3";
  secondary.style.fontWeight = "500";
  secondary.style.color = "#6B7280";
  secondary.style.overflow = "hidden";
  secondary.style.textOverflow = "ellipsis";

  const controls = document.createElement("div");
  controls.className = "engage-dashboard-greeting-controls";
  controls.style.display = "flex";
  controls.style.alignItems = "center";
  controls.style.justifyContent = "flex-end";
  controls.style.flexShrink = "0";

  left.append(primary, secondary);
  row.append(left, controls);
  return row;
}

function moveTeamSelect(greeting) {
  const select = dashboardTeamSelect();
  const controls = greeting?.querySelector(".engage-dashboard-greeting-controls");
  if (!select || !controls) return;

  if (!select.__engageOriginalParent) {
    select.__engageOriginalParent = select.parentElement;
    select.__engageOriginalNextSibling = select.nextSibling;
    select.__engageOriginalCssText = select.style.cssText;
    select.__engageOriginalRow = select.parentElement;
  }

  controls.appendChild(select);
  select.style.flex = "0 0 auto";
  select.style.width = "auto";
  select.style.minWidth = "128px";
  select.style.height = "34px";
  select.style.padding = "5px 30px 5px 10px";
  select.style.borderRadius = "9px";
  select.style.fontSize = "12.5px";
  select.style.fontWeight = "600";
  select.style.background = "#fff";
  select.style.border = "1px solid #E7E9EE";
  select.style.color = "#1A1D23";
  select.style.cursor = "pointer";

  const originalRow = select.__engageOriginalRow;
  if (originalRow && originalRow !== controls) originalRow.style.display = "none";
}

function render() {
  queued = false;

  if (!window.matchMedia("(min-width: 900px)").matches) {
    removeGreeting();
    return;
  }

  const conversation = findCard("Conversation");
  const totalLeads = findCard("Total Leads");
  const won = findCard("Won");
  if (!conversation || !totalLeads || !won) {
    removeGreeting();
    return;
  }

  const cardRow = conversation.parentElement;
  if (!cardRow || totalLeads.parentElement !== cardRow || won.parentElement !== cardRow || !cardRow.parentElement) return;

  let greeting = document.querySelector(".engage-dashboard-greeting");
  if (!greeting) {
    greeting = createGreeting();
    cardRow.parentElement.insertBefore(greeting, cardRow);
  } else if (greeting.nextElementSibling !== cardRow) {
    cardRow.parentElement.insertBefore(greeting, cardRow);
  }

  const primary = greeting.querySelector(".engage-dashboard-greeting-primary");
  if (primary) primary.textContent = `${greetingForHour(new Date().getHours())}, Aamil 👋`;

  moveTeamSelect(greeting);
}

function queueRender() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(render);
}

function install() {
  if (observer) return;
  observer = new MutationObserver(queueRender);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.addEventListener("resize", queueRender);
  window.addEventListener("focus", queueRender);
  setTimeout(queueRender, 0);
}

install();
