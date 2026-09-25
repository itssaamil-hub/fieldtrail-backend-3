import { api, mapSalesmanRow } from "./api.js";

let observer = null;
let queued = false;
let teamRows = [];
let teamLoadTimer = null;
let teamLoading = false;

function isVisible(node) {
  if (!node || !node.isConnected || node.closest("[hidden]")) return false;
  const style = window.getComputedStyle(node);
  return style.display !== "none" && style.visibility !== "hidden" && node.getClientRects().length > 0;
}

function originalButtonByText(text) {
  return [...document.querySelectorAll("button")].find((button) => {
    if (button.closest(".engage-map-view-switcher")) return false;
    return (button.textContent || "").replace(/\s+/g, " ").trim() === text;
  }) || null;
}

function findMapCard() {
  return [...document.querySelectorAll(".ft-card")].find((card) => {
    if (!isVisible(card)) return false;
    const header = card.firstElementChild;
    if (!header) return false;
    const text = (header.textContent || "").replace(/\s+/g, " ").trim();
    return text.includes("Live Employees & Lead Map") || text.startsWith("Lead Locations");
  }) || null;
}

function originalControlsRow(liveButton, leadButton) {
  const liveRow = liveButton?.parentElement?.parentElement;
  const leadRow = leadButton?.parentElement?.parentElement;
  return liveRow && liveRow === leadRow ? liveRow : null;
}

function buttonLooksActive(button) {
  if (!button) return false;
  const style = window.getComputedStyle(button);
  const bg = style.backgroundColor || "";
  const color = style.color || "";
  return button.getAttribute("aria-pressed") === "true" ||
    button.dataset.active === "true" ||
    /145c5d|18, 128, 92|20, 92, 93/i.test(`${button.style.background} ${button.style.backgroundColor} ${bg} ${color}`);
}

function styleProxy(proxy, source, active) {
  proxy.style.height = "32px";
  proxy.style.padding = "5px 10px";
  proxy.style.borderRadius = "8px";
  proxy.style.fontSize = "12px";
  proxy.style.fontWeight = "650";
  proxy.style.whiteSpace = "nowrap";
  proxy.style.cursor = "pointer";
  proxy.style.border = active ? "1px solid #145C5D" : "1px solid #E7E9EE";
  proxy.style.background = active ? "#EAF4F3" : "#fff";
  proxy.style.color = active ? "#145C5D" : "#4B5563";
  proxy.style.boxShadow = "none";
  proxy.disabled = !!source?.disabled;
}

function ensureProxy(switcher, key, label, source) {
  let proxy = switcher.querySelector(`[data-engage-map-proxy="${key}"]`);
  if (!proxy) {
    proxy = document.createElement("button");
    proxy.type = "button";
    proxy.dataset.engageMapProxy = key;
    proxy.textContent = label;
    proxy.addEventListener("click", () => {
      const original = originalButtonByText(label);
      original?.click();
    });
    switcher.appendChild(proxy);
  }
  styleProxy(proxy, source, buttonLooksActive(source));
  return proxy;
}

function minutesSince(value) {
  if (!value) return Infinity;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return Infinity;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
}

function fieldState(row) {
  const mins = minutesSince(row.lastUpdate);
  if (row.status === "online" && mins <= 5) return "live";
  if (mins <= 30) return "stale";
  return "offline";
}

function freshnessLabel(row) {
  const mins = minutesSince(row.lastUpdate);
  if (!Number.isFinite(mins)) return "No GPS";
  if (mins < 1) return "Now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

function openRouteFor(name) {
  const employeeCard = [...document.querySelectorAll(".ft-card")].find((card) => {
    const text = (card.textContent || "").replace(/\s+/g, " ");
    return text.includes("Employees") && text.includes(name);
  });
  if (!employeeCard) return;

  const candidates = [...employeeCard.querySelectorAll("button")];
  const nameNode = [...employeeCard.querySelectorAll("div,span,strong")].find((node) => (node.textContent || "").trim() === name);
  const row = nameNode?.parentElement?.parentElement?.parentElement || nameNode?.parentElement?.parentElement;
  const routeButton = row ? [...row.querySelectorAll("button")].find((b) => /View route/i.test(b.textContent || "")) : null;
  (routeButton || candidates.find((b) => /View route/i.test(b.textContent || "")))?.click();
}

function renderTeamPulse(mapCard) {
  let pulse = mapCard.querySelector(".engage-map-team-pulse");
  if (!teamRows.length) {
    pulse?.remove();
    return;
  }

  if (!pulse) {
    pulse = document.createElement("div");
    pulse.className = "engage-map-team-pulse";
    pulse.style.display = "flex";
    pulse.style.alignItems = "center";
    pulse.style.gap = "8px";
    pulse.style.padding = "9px 12px";
    pulse.style.margin = "0 0 10px";
    pulse.style.border = "1px solid #E7E9EE";
    pulse.style.borderRadius = "11px";
    pulse.style.background = "#FBFCFC";
    pulse.style.overflowX = "auto";
    pulse.style.scrollbarWidth = "thin";
    const header = mapCard.firstElementChild;
    header?.insertAdjacentElement("afterend", pulse);
  }

  const counts = teamRows.reduce((acc, row) => {
    acc[fieldState(row)] += 1;
    return acc;
  }, { live: 0, stale: 0, offline: 0 });

  pulse.innerHTML = "";

  const summary = document.createElement("div");
  summary.style.display = "flex";
  summary.style.alignItems = "center";
  summary.style.gap = "7px";
  summary.style.paddingRight = "10px";
  summary.style.borderRight = "1px solid #E7E9EE";
  summary.style.flex = "none";
  summary.innerHTML = `
    <span style="width:8px;height:8px;border-radius:50%;background:#12805C;box-shadow:0 0 0 3px #E6F6EF"></span>
    <strong style="font-size:11.5px;color:#253334;white-space:nowrap">${counts.live} live</strong>
    ${counts.stale ? `<span style="font-size:10.5px;color:#9A671B;white-space:nowrap">${counts.stale} stale</span>` : ""}
    ${counts.offline ? `<span style="font-size:10.5px;color:#8A9294;white-space:nowrap">${counts.offline} offline</span>` : ""}
  `;
  pulse.appendChild(summary);

  teamRows
    .slice()
    .sort((a, b) => ({ live: 0, stale: 1, offline: 2 }[fieldState(a)] - ({ live: 0, stale: 1, offline: 2 }[fieldState(b)])))
    .forEach((row) => {
      const state = fieldState(row);
      const chip = document.createElement("div");
      chip.style.display = "flex";
      chip.style.alignItems = "center";
      chip.style.gap = "7px";
      chip.style.padding = "6px 8px";
      chip.style.borderRadius = "9px";
      chip.style.background = "#fff";
      chip.style.border = state === "stale" ? "1px solid #F2D39A" : state === "offline" ? "1px solid #E7E9EE" : "1px solid #D9EAE4";
      chip.style.flex = "none";

      const dotColor = state === "live" ? "#12805C" : state === "stale" ? "#D3932B" : "#A4AAAC";
      const km = Number(row.distanceM || 0) / 1000;
      chip.innerHTML = `
        <span style="width:7px;height:7px;border-radius:50%;background:${dotColor};flex:none"></span>
        <div style="line-height:1.15">
          <div style="font-size:11px;font-weight:700;color:#263839;white-space:nowrap">${row.name || "Employee"}</div>
          <div style="font-size:9.5px;color:#7B8587;white-space:nowrap">GPS ${freshnessLabel(row)} · ${km.toFixed(1)} km</div>
        </div>
      `;

      const route = document.createElement("button");
      route.type = "button";
      route.textContent = "Route";
      route.title = `View ${row.name || "employee"}'s route`;
      route.style.border = "0";
      route.style.background = "#EDF7F5";
      route.style.color = "#145C5D";
      route.style.borderRadius = "7px";
      route.style.padding = "5px 7px";
      route.style.fontSize = "9.5px";
      route.style.fontWeight = "750";
      route.style.cursor = "pointer";
      route.addEventListener("click", () => openRouteFor(row.name));
      chip.appendChild(route);
      pulse.appendChild(chip);
    });
}

async function loadTeamPulse() {
  if (teamLoading || !window.matchMedia("(min-width: 900px)").matches) return;
  teamLoading = true;
  try {
    const result = await api.adminSalesmen();
    teamRows = (result?.salesmen || []).map(mapSalesmanRow).filter((row) => row.isActive !== false);
    const mapCard = findMapCard();
    if (mapCard) renderTeamPulse(mapCard);
  } catch {
    // Keep the existing map untouched if the supplementary pulse cannot load.
  } finally {
    teamLoading = false;
  }
}

function restoreMobile() {
  document.querySelectorAll(".engage-map-view-switcher,.engage-map-team-pulse").forEach((node) => node.remove());
  document.querySelectorAll('[data-engage-map-original-row="true"]').forEach((row) => {
    row.style.display = row.dataset.engageOriginalDisplay || "";
    delete row.dataset.engageMapOriginalRow;
    delete row.dataset.engageOriginalDisplay;
  });
}

function apply() {
  queued = false;

  const desktop = window.matchMedia("(min-width: 900px)").matches;
  if (!desktop) {
    restoreMobile();
    return;
  }

  const liveButton = originalButtonByText("Live Map");
  const leadButton = originalButtonByText("Lead Locations");
  const mapCard = findMapCard();
  if (!mapCard || !liveButton || !leadButton) return;

  const row = originalControlsRow(liveButton, leadButton);
  if (row && row.dataset.engageMapOriginalRow !== "true") {
    row.dataset.engageMapOriginalRow = "true";
    row.dataset.engageOriginalDisplay = row.style.display || "";
  }
  if (row) row.style.display = "none";

  const header = mapCard.firstElementChild;
  if (!header) return;
  header.style.justifyContent = "flex-start";

  let switcher = header.querySelector(".engage-map-view-switcher");
  if (!switcher) {
    switcher = document.createElement("div");
    switcher.className = "engage-map-view-switcher";
    switcher.style.display = "flex";
    switcher.style.alignItems = "center";
    switcher.style.gap = "6px";
    header.appendChild(switcher);
  }
  switcher.style.marginLeft = "auto";
  switcher.style.marginRight = "0";

  ensureProxy(switcher, "live", "Live Map", liveButton);
  ensureProxy(switcher, "leads", "Lead Locations", leadButton);

  const liveStatus = [...header.children].find((child) => child !== switcher && /LIVE/.test(child.textContent || ""));
  if (liveStatus) liveStatus.style.marginLeft = "12px";

  renderTeamPulse(mapCard);
}

function queueApply() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(apply);
}

function install() {
  if (observer) return;
  observer = new MutationObserver(queueApply);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.addEventListener("resize", queueApply);
  window.addEventListener("focus", () => { queueApply(); loadTeamPulse(); });
  setTimeout(() => { queueApply(); loadTeamPulse(); }, 0);
  teamLoadTimer = window.setInterval(loadTeamPulse, 60000);
}

install();
