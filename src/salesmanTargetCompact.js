import './salesman-target-compact.css';

let observer = null;
let queued = false;

function isVisible(node) {
  if (!node || !node.isConnected || node.closest('[hidden]')) return false;
  const style = window.getComputedStyle(node);
  return style.display !== 'none' && style.visibility !== 'hidden' && node.getClientRects().length > 0;
}

function applyCompactTargetCard() {
  queued = false;
  if (window.matchMedia('(min-width: 900px)').matches) return;

  const heading = [...document.querySelectorAll('div')].find((node) =>
    isVisible(node) && (node.textContent || '').trim() === 'Your Targets'
  );
  if (!heading) return;

  const card = heading.closest('.ft-card') || heading.parentElement?.parentElement;
  if (!card) return;
  card.classList.add('engage-salesman-target-card');

  const children = [...card.children];
  for (const child of children) {
    const text = (child.textContent || '').trim();
    const style = child.getAttribute('style') || '';
    if (!text && (style.includes('border-top') || style.includes('borderTop'))) {
      child.classList.add('engage-target-divider');
    }
    if (child.querySelector?.('div[style*="width"]') && child.querySelector?.('div[style*="background"]')) {
      child.classList.add('engage-target-progress');
    }
    if (/more to hit|remaining/i.test(text)) {
      child.classList.add('engage-target-remaining');
    }
  }

  const addLead = [...document.querySelectorAll('button')].find((node) =>
    isVisible(node) && (node.textContent || '').trim() === 'Add Lead'
  );
  const myLeads = [...document.querySelectorAll('button')].find((node) =>
    isVisible(node) && (node.textContent || '').trim() === 'My Leads'
  );

  if (addLead) {
    const labelNode = [...addLead.querySelectorAll('*')].find((node) =>
      (node.textContent || '').trim() === 'Add Lead' && node.children.length === 0
    );
    if (labelNode) labelNode.textContent = 'Add Deal';
    else addLead.textContent = 'Add Deal';

    const grid = addLead.parentElement;
    if (grid && myLeads && myLeads.parentElement === grid) {
      grid.classList.add('engage-salesman-action-grid');
    }
  }
}

function queueApply() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => requestAnimationFrame(applyCompactTargetCard));
}

observer = new MutationObserver(queueApply);
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
window.addEventListener('resize', queueApply);
window.addEventListener('focus', queueApply);
setTimeout(queueApply, 80);
