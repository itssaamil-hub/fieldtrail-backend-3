let queued = false;

function normalize(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function isVisible(node) {
  if (!node || !node.isConnected) return false;
  const style = getComputedStyle(node);
  return style.display !== 'none' && style.visibility !== 'hidden' && node.getClientRects().length > 0;
}

function findAddLeadPanel() {
  if (!window.matchMedia('(max-width: 560px)').matches) return null;
  const fixed = [...document.querySelectorAll('div')].filter((node) => {
    const style = getComputedStyle(node);
    return style.position === 'fixed' && style.inset !== 'auto' && isVisible(node);
  });

  for (const overlay of fixed) {
    const panel = [...overlay.children].find((child) => {
      if (!(child instanceof HTMLElement) || !isVisible(child)) return false;
      const header = child.firstElementChild;
      if (!header) return false;
      return normalize(header.textContent).startsWith('Add Lead');
    });
    if (panel) return panel;
  }
  return null;
}

function markSections(panel) {
  panel.querySelectorAll('[role="heading"][aria-level="3"]').forEach((heading) => {
    const label = normalize(heading.textContent).toLowerCase();
    if (label.includes('restaurant')) heading.dataset.mobileLeadSection = 'restaurant';
    else if (label.includes('contact')) heading.dataset.mobileLeadSection = 'contact';
    else if (label.includes('deal')) heading.dataset.mobileLeadSection = 'deal';
  });
}

function markFields(panel) {
  [...panel.querySelectorAll('div')].forEach((node) => {
    const label = normalize(node.textContent);
    if (label === 'Comments' || label.startsWith('Comments *')) {
      const field = node.parentElement;
      if (field) field.dataset.mobileLeadComments = 'true';
    }
    if (label === 'Status' || label === 'Status *' || label === 'Stage') {
      const field = node.parentElement;
      if (field) field.dataset.mobileLeadStage = 'true';
    }
  });
}

function markSave(panel) {
  const buttons = [...panel.querySelectorAll('button')];
  const save = buttons.find((button) => /^(Save Lead|Save Lead \(offline\)|Add Lead|Saving…|Adding…)$/.test(normalize(button.textContent)));
  if (save) save.dataset.mobileLeadSave = 'true';
}

function apply() {
  queued = false;
  const panel = findAddLeadPanel();
  if (!panel) return;
  panel.classList.add('engage-mobile-add-lead-polish');
  markSections(panel);
  markFields(panel);
  markSave(panel);
}

function queue() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(apply);
}

new MutationObserver(queue).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
window.addEventListener('resize', queue);
window.addEventListener('focus', queue);
setTimeout(queue, 0);
