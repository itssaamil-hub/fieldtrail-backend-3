let observer = null;
let queued = false;

function isVisible(node) {
  if (!node || !node.isConnected || node.closest("[hidden]")) return false;
  const style = window.getComputedStyle(node);
  return style.display !== "none" && style.visibility !== "hidden" && node.getClientRects().length > 0;
}

function buttonByText(text) {
  return [...document.querySelectorAll("button")].find((button) => {
    if (!isVisible(button)) return false;
    return (button.textContent || "").replace(/\s+/g, " ").trim() === text;
  }) || null;
}

function findMapCard() {
  return [...document.querySelectorAll(".ft-card")].find((card) => {
    if (!isVisible(card)) return false;
    const header = card.firstElementChild;
    if (!header) return false;
    return (header.textContent || "").includes("Live Employees & Lead Map");
  }) || null;
}

function restoreMobile() {
  const switcher = document.querySelector(".engage-map-view-switcher");
  if (!switcher) return;
  const originalRow = switcher.dataset.originalRowId
    ? document.getElementById(switcher.dataset.originalRowId)
    : null;
  if (!originalRow) return;

  [...switcher.querySelectorAll("button")].forEach((button) => {
    const wrapper = button.__engageOriginalWrapper;
    if (wrapper) wrapper.appendChild(button);
  });
  switcher.remove();
}

function apply() {
  queued = false;

  const desktop = window.matchMedia("(min-width: 900px)").matches;
  if (!desktop) {
    restoreMobile();
    return;
  }

  const mapCard = findMapCard();
  const liveButton = buttonByText("Live Map");
  const leadButton = buttonByText("Lead Locations");
  if (!mapCard || !liveButton || !leadButton) return;

  const header = mapCard.firstElementChild;
  if (!header) return;

  let switcher = header.querySelector(".engage-map-view-switcher");
  if (!switcher) {
    switcher = document.createElement("div");
    switcher.className = "engage-map-view-switcher";
    switcher.style.display = "flex";
    switcher.style.alignItems = "center";
    switcher.style.gap = "6px";
    switcher.style.marginLeft = "12px";
    switcher.style.marginRight = "auto";

    const originalRow = liveButton.parentElement?.parentElement;
    if (originalRow) {
      if (!originalRow.id) originalRow.id = "engage-map-controls-original-row";
      switcher.dataset.originalRowId = originalRow.id;
    }

    header.style.justifyContent = "flex-start";
    header.appendChild(switcher);
  }

  [liveButton, leadButton].forEach((button) => {
    if (!button.__engageOriginalWrapper) button.__engageOriginalWrapper = button.parentElement;
    button.style.whiteSpace = "nowrap";
    button.style.minWidth = "auto";
    switcher.appendChild(button);
  });

  const liveStatus = [...header.children].find((child) => child !== switcher && /LIVE/.test(child.textContent || ""));
  if (liveStatus) {
    liveStatus.style.marginLeft = "auto";
    header.appendChild(liveStatus);
  }
}

function queueApply() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(apply);
}

function install() {
  if (observer) return;
  observer = new MutationObserver(queueApply);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("resize", queueApply);
  window.addEventListener("focus", queueApply);
  setTimeout(queueApply, 0);
}

install();
