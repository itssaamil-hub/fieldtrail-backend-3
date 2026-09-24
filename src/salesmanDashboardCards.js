const LABELS = ["Today", "Hot", "Conversation", "Negotiation", "Won", "Renewals"];

function isPhone() {
  return window.matchMedia("(max-width: 899px)").matches;
}

function normalize(text) {
  return String(text || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function cardLabel(card) {
  const first = card?.firstElementChild;
  const labelNode = first?.firstElementChild;
  return normalize(labelNode?.textContent || "");
}

function apply() {
  if (!isPhone()) return;

  document.querySelectorAll(".ft-card").forEach((card) => {
    const label = cardLabel(card);
    const match = LABELS.find((name) => label === name.toLowerCase());
    if (!match) return;

    card.classList.add("engage-salesman-water-card");
    card.dataset.kpi = match.toLowerCase();
  });
}

let queued = false;
function queueApply() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    apply();
  });
}

const observer = new MutationObserver(queueApply);
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
window.addEventListener("resize", queueApply);
window.addEventListener("focus", queueApply);
setTimeout(queueApply, 0);
