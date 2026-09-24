const KPI_LABELS = [
  "Total Employees",
  "Conversation",
  "Leads Today",
  "Hot Leads",
  "In Negotiation",
  "Total Leads",
  "Won",
  "Upcoming Follow-up",
  "Renewals Due",
];

const ICONS = {
  "Total Employees": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  Conversation: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>',
  "Leads Today": '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M12 14v4M10 16h4"/>',
  "Hot Leads": '<path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-2 1-4 3-6 0 3 1 4 1 4s1-2 0-6z"/><path d="M8 14a4 4 0 1 0 8 0c0-1.5-.8-3-2-4"/>',
  "In Negotiation": '<path d="M8 12l3 3 5-5"/><path d="M2 12l4-4 4 4M22 12l-4-4-2 2M6 8l3-3a3 3 0 0 1 4 0l1 1"/>',
  "Total Leads": '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2"/>',
  Won: '<circle cx="12" cy="12" r="9"/><path d="M8 12l2.5 2.5L16 9"/>',
  "Upcoming Follow-up": '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/><circle cx="16" cy="16" r="3"/><path d="M16 14.5V16l1 1"/>',
  "Renewals Due": '<path d="M20 11a8 8 0 1 0-2.34 5.66"/><path d="M20 4v7h-7"/>',
};

const ICON_COLORS = {
  "Total Employees": "#64748B",
  Conversation: "#145C5D",
  "Leads Today": "#3B82F6",
  "Hot Leads": "#C0392B",
  "In Negotiation": "#8B5CF6",
  "Total Leads": "#0891B2",
  Won: "#12805C",
  "Upcoming Follow-up": "#B8791F",
  "Renewals Due": "#F5793B",
};

const ICON_BACKGROUNDS = {
  "Total Employees": "#F1F5F9",
  Conversation: "#EDF7F5",
  "Leads Today": "#EEF4FF",
  "Hot Leads": "#FDEDEC",
  "In Negotiation": "#F3EFFF",
  "Total Leads": "#ECF8FA",
  Won: "#EAF7F2",
  "Upcoming Follow-up": "#FFF6E8",
  "Renewals Due": "#FFF1E8",
};

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
    return label === "Hot Leads" ? text.startsWith("Hot Leads") : text.startsWith(label);
  }) || null;
}

function findValueNode(card) {
  if (!card) return null;
  return [...card.children].find((node) => {
    const family = node?.style?.fontFamily || "";
    return family.includes("Space Grotesk") || node?.style?.fontSize === "24px" || node?.style?.fontSize === "30px" || node?.classList?.contains("engage-db-value");
  }) || null;
}

function ensureIcon(header, label) {
  if (!header) return;
  let wrap = header.querySelector(".engage-kpi-card-icon");
  if (!wrap) {
    wrap = document.createElement("span");
    wrap.className = "engage-kpi-card-icon";
    wrap.setAttribute("aria-hidden", "true");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.9");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.innerHTML = ICONS[label] || ICONS["Total Leads"];
    wrap.appendChild(svg);
    header.appendChild(wrap);
  }
  wrap.style.width = "32px";
  wrap.style.height = "32px";
  wrap.style.borderRadius = "10px";
  wrap.style.display = "inline-flex";
  wrap.style.alignItems = "center";
  wrap.style.justifyContent = "center";
  wrap.style.flexShrink = "0";
  wrap.style.background = ICON_BACKGROUNDS[label] || "#F1F5F9";
  wrap.style.color = ICON_COLORS[label] || "#64748B";
}

function applyDesktop(card, label) {
  if (!card) return;
  card.classList.add("engage-kpi-desktop-card");
  card.style.flex = "1 1 205px";
  card.style.minWidth = "205px";
  card.style.minHeight = "96px";
  card.style.padding = "10px 15px 9px";
  card.style.borderRadius = "14px";
  card.style.boxSizing = "border-box";
  card.style.overflow = "hidden";
  card.style.background = "#FFFFFF";
  card.style.border = "1px solid #E4E8EB";
  card.style.boxShadow = "none";
  card.style.transition = "transform .15s ease, box-shadow .15s ease, border-color .15s ease";

  const header = card.children[0];
  if (header) {
    header.style.marginBottom = "5px";
    header.style.gap = "9px";
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.justifyContent = "space-between";
    const title = header.children[0];
    if (title) {
      title.style.fontSize = "10.5px";
      title.style.letterSpacing = ".15px";
      title.style.fontWeight = "700";
      title.style.color = "#6F7B7D";
      title.style.textTransform = "none";
    }
    ensureIcon(header, label);
  }

  const value = findValueNode(card);
  if (value) {
    value.classList.add("engage-db-value");
    value.style.fontFamily = "'Space Grotesk', sans-serif";
    value.style.fontSize = "29px";
    value.style.fontWeight = "700";
    value.style.lineHeight = "1";
    value.style.letterSpacing = "-.45px";
    value.style.color = "#173738";
  }

  [...card.children].forEach((node) => {
    if (node === header || node === value) return;
    if (node.classList?.contains("engage-db-comparison")) {
      node.style.marginTop = "3px";
      node.style.fontSize = "9.8px";
      node.style.fontWeight = "650";
      node.style.lineHeight = "1.2";
      return;
    }
    if (node.tagName === "DIV") {
      node.style.fontSize = "10.5px";
      node.style.lineHeight = "1.2";
      node.style.marginTop = "3px";
      node.style.color = "#899092";
    }
  });

  if (!card.dataset.exceptionHoverBound) {
    card.dataset.exceptionHoverBound = "1";
    card.addEventListener("mouseenter", () => {
      if (!window.matchMedia("(min-width: 900px)").matches) return;
      card.style.transform = "translateY(-1px)";
      card.style.boxShadow = "0 6px 20px rgba(32,64,64,.07)";
      card.style.borderColor = "#D8E2E0";
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "translateY(0)";
      card.style.boxShadow = "none";
      card.style.borderColor = "#E4E8EB";
    });
  }
}

function resetMobile(card) {
  if (!card) return;
  card.classList.remove("engage-kpi-desktop-card");
  card.querySelectorAll(".engage-kpi-card-icon").forEach((node) => node.remove());
  card.style.flex = "1";
  card.style.minWidth = "96px";
  card.style.minHeight = "";
  card.style.padding = "14px 16px";
  card.style.borderRadius = "14px";
  card.style.background = "";
  card.style.border = "";
  card.style.boxShadow = "";
  card.style.transition = "";
  card.style.transform = "";

  const header = card.children[0];
  if (header) {
    header.style.marginBottom = "8px";
    header.style.gap = "6px";
    header.style.display = "";
    header.style.alignItems = "";
    header.style.justifyContent = "";
    const title = header.children[0];
    if (title) {
      title.style.fontSize = "9px";
      title.style.letterSpacing = ".2px";
      title.style.fontWeight = "700";
      title.style.color = "";
      title.style.textTransform = "";
    }
  }

  const value = findValueNode(card);
  if (value) {
    value.style.fontSize = "24px";
    value.style.lineHeight = "";
    value.style.letterSpacing = "";
    value.style.color = "";
  }
}

function apply() {
  queued = false;
  const desktop = window.matchMedia("(min-width: 900px)").matches;
  KPI_LABELS.forEach((label) => {
    const card = findCard(label);
    if (!card) return;
    if (desktop) applyDesktop(card, label);
    else resetMobile(card);
  });
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
