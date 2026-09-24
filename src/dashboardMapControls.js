let observer = null;
let queued = false;

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

function restoreMobile() {
  document.querySelectorAll(".engage-map-view-switcher").forEach((node) => node.remove());
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
    switcher.style.marginLeft = "12px";
    switcher.style.marginRight = "auto";
    header.appendChild(switcher);
  }

  ensureProxy(switcher, "live", "Live Map", liveButton);
  ensureProxy(switcher, "leads", "Lead Locations", leadButton);

  const liveStatus = [...header.children].find((child) => child !== switcher && /LIVE/.test(child.textContent || ""));
  if (liveStatus) liveStatus.style.marginLeft = "auto";
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
  window.addEventListener("focus", queueApply);
  setTimeout(queueApply, 0);
}

install();
