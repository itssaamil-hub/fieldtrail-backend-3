const MOBILE_KPI_LABELS = [
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

let queued = false;
let observer = null;

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

function valueNode(card) {
  if (!card) return null;
  return [...card.children].find((node) => {
    const family = node?.style?.fontFamily || "";
    return node?.classList?.contains("engage-db-value") || family.includes("Space Grotesk") || node?.style?.fontSize === "24px" || node?.style?.fontSize === "30px";
  }) || null;
}

function copyStyle(target, source, properties) {
  if (!target || !source) return;
  const computed = window.getComputedStyle(source);
  properties.forEach((property) => {
    target.style[property] = computed[property];
  });
}

function applyMobileMatch() {
  queued = false;
  if (window.matchMedia("(min-width: 900px)").matches) return;

  // Conversation is the approved mobile visual reference. We only copy styling;
  // no nodes, icons, values or subtext are added or removed here.
  const reference = findCard("Conversation") || findCard("Won");
  if (!reference) return;

  const referenceHeader = reference.children[0];
  const referenceTitle = referenceHeader?.children?.[0];
  const referenceValue = valueNode(reference);

  MOBILE_KPI_LABELS.forEach((label) => {
    const card = findCard(label);
    if (!card || card === reference) return;

    copyStyle(card, reference, [
      "backgroundColor",
      "borderTopWidth",
      "borderRightWidth",
      "borderBottomWidth",
      "borderLeftWidth",
      "borderTopStyle",
      "borderRightStyle",
      "borderBottomStyle",
      "borderLeftStyle",
      "borderTopColor",
      "borderRightColor",
      "borderBottomColor",
      "borderLeftColor",
      "borderRadius",
      "boxShadow",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
      "minHeight",
      "overflow",
    ]);

    const header = card.children[0];
    const title = header?.children?.[0];
    const value = valueNode(card);

    copyStyle(header, referenceHeader, [
      "marginBottom",
      "gap",
      "alignItems",
      "justifyContent",
    ]);
    copyStyle(title, referenceTitle, [
      "fontSize",
      "fontWeight",
      "fontFamily",
      "letterSpacing",
      "lineHeight",
      "color",
      "textTransform",
    ]);
    copyStyle(value, referenceValue, [
      "fontSize",
      "fontWeight",
      "fontFamily",
      "letterSpacing",
      "lineHeight",
      "color",
    ]);
  });
}

function queueApply() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => requestAnimationFrame(applyMobileMatch));
}

function install() {
  if (observer) return;
  observer = new MutationObserver(queueApply);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.addEventListener("resize", queueApply);
  window.addEventListener("focus", queueApply);
  setTimeout(queueApply, 60);
}

install();
