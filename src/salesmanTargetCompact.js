import './salesman-target-compact.css';

let observer = null;
let queued = false;

function isVisible(node) {
  if (!node || !node.isConnected || node.closest('[hidden]')) return false;
  const style = window.getComputedStyle(node);
  return style.display !== 'none' && style.visibility !== 'hidden' && node.getClientRects().length > 0;
}

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning 👋';
  if (hour < 17) return 'Good afternoon 👋';
  return 'Good evening 👋';
}

function applyCompactTargetCard() {
  queued = false;
  if (window.matchMedia('(min-width: 900px)').matches) return;

  const heading = [...document.querySelectorAll('div')].find((node) =>
    isVisible(node) && (node.textContent || '').trim() === 'Your Targets'
  );

  if (heading) {
    const card = heading.closest('.ft-card') || heading.parentElement?.parentElement;
    if (card) {
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
    }
  }

  const addDeal = [...document.querySelectorAll('button')].find((node) => {
    if (!isVisible(node)) return false;
    const text = (node.textContent || '').trim();
    return text === 'Add Deal' || text === 'Add Lead';
  });
  const myLeads = [...document.querySelectorAll('button')].find((node) =>
    isVisible(node) && (node.textContent || '').trim() === 'My Leads'
  );

  if (addDeal) {
    if ((addDeal.textContent || '').trim() === 'Add Lead') {
      const labelNode = [...addDeal.querySelectorAll('*')].find((node) =>
        (node.textContent || '').trim() === 'Add Lead' && node.children.length === 0
      );
      if (labelNode) labelNode.textContent = 'Add Deal';
    }

    const grid = addDeal.parentElement;
    if (grid && myLeads && myLeads.parentElement === grid) {
      grid.classList.add('engage-salesman-action-grid');
    }
  }

  const dayButton = [...document.querySelectorAll('button')].find((node) => {
    if (!isVisible(node)) return false;
    const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
    return /^(Start Day|End Day|Starting…|Ending…|Started|Ended)$/.test(text);
  });

  const headerRow = dayButton?.parentElement;
  const identityBlock = headerRow?.firstElementChild;
  if (identityBlock && identityBlock !== dayButton) {
    const rows = [...identityBlock.children];
    if (rows.length >= 2) {
      rows[1].textContent = greetingForNow();
      rows[1].classList.add('engage-salesman-greeting');
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
setInterval(queueApply, 60000);
setTimeout(queueApply, 80);
