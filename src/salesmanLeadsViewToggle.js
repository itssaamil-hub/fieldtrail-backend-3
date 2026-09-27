import './salesman-leads-view-toggle.css';

const STAGES = ['Cold', 'Conversation', 'Hot', 'Demo', 'Negotiation', 'Won', 'Lost', 'Nurture'];
const LIST_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>';
const BOARD_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="10" rx="1"/></svg>';

let observer = null;
let queued = false;

function visible(node) {
  if (!node || !node.isConnected || node.closest('[hidden]')) return false;
  const style = getComputedStyle(node);
  return style.display !== 'none' && style.visibility !== 'hidden' && node.getClientRects().length > 0;
}

function getLeadRows(section) {
  return [...section.querySelectorAll('.ft-row')].filter((row) => {
    if (!visible(row)) return false;
    return !!row.querySelector('.employee-mobile-lead-meta, .employee-mobile-brief-pill, .ft-lead-brief-pill');
  });
}

function leadInfo(row) {
  const name = [...row.querySelectorAll('div')].find((n) => {
    const style = n.getAttribute('style') || '';
    return style.includes('font-weight: 600') || style.includes('fontWeight: 600');
  })?.textContent?.trim() || row.textContent?.trim().split(/Brief|Cold|Conversation|Hot|Demo|Negotiation|Won|Lost|Nurture/)[0]?.trim() || 'Lead';

  const meta = row.querySelector('.employee-mobile-lead-meta');
  const stage = meta?.querySelector('span')?.textContent?.trim() || STAGES.find((s) => row.textContent?.includes(s)) || 'Cold';
  const attention = meta?.textContent?.trim()?.replace(stage, '').replace(/^\s*·\s*/, '') || '';
  return { name, stage, attention };
}

function buildKanban(section, rows, selectedStage) {
  let board = section.querySelector('.engage-salesman-kanban');
  if (!board) {
    board = document.createElement('div');
    board.className = 'engage-salesman-kanban';
  }
  board.innerHTML = '';

  const items = rows.map((row) => ({ row, ...leadInfo(row) }));
  const counts = Object.fromEntries(STAGES.map((s) => [s, items.filter((x) => x.stage === s).length]));
  const active = STAGES.includes(selectedStage) ? selectedStage : (STAGES.find((s) => counts[s] > 0) || 'Conversation');
  section.dataset.kanbanStage = active;

  const stages = document.createElement('div');
  stages.className = 'engage-salesman-kanban-stages';
  STAGES.forEach((stage) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `engage-salesman-kanban-stage${stage === active ? ' is-active' : ''}`;
    btn.innerHTML = `${stage}<span class="engage-salesman-kanban-stage-count">${counts[stage] || 0}</span>`;
    btn.addEventListener('click', () => buildKanban(section, rows, stage));
    stages.appendChild(btn);
  });
  board.appendChild(stages);

  const column = document.createElement('div');
  column.className = 'engage-salesman-kanban-column';
  const head = document.createElement('div');
  head.className = 'engage-salesman-kanban-column-head';
  head.innerHTML = `<span>${active}</span><span>${counts[active] || 0} deal${counts[active] === 1 ? '' : 's'}</span>`;
  column.appendChild(head);

  const stageItems = items.filter((x) => x.stage === active);
  if (!stageItems.length) {
    const empty = document.createElement('div');
    empty.className = 'engage-salesman-kanban-empty';
    empty.textContent = `No ${active.toLowerCase()} deals.`;
    column.appendChild(empty);
  } else {
    stageItems.forEach((item) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'engage-salesman-kanban-card';
      card.innerHTML = `<div class="engage-salesman-kanban-card-name"></div><div class="engage-salesman-kanban-card-meta"></div>`;
      card.querySelector('.engage-salesman-kanban-card-name').textContent = item.name;
      card.querySelector('.engage-salesman-kanban-card-meta').textContent = item.attention || item.stage;
      card.addEventListener('click', () => item.row.click());
      column.appendChild(card);
    });
  }
  board.appendChild(column);

  const listContainer = rows[0]?.parentElement;
  if (listContainer) {
    listContainer.style.display = 'none';
    listContainer.insertAdjacentElement('afterend', board);
  }
}

function setMode(section, mode) {
  section.dataset.leadsView = mode;
  const toggle = section.querySelector('.engage-salesman-leads-view-toggle');
  toggle?.querySelectorAll('button').forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  const rows = getLeadRows(section);
  const listContainer = rows[0]?.parentElement;
  const board = section.querySelector('.engage-salesman-kanban');
  if (mode === 'list') {
    if (listContainer) listContainer.style.display = '';
    board?.remove();
    return;
  }
  buildKanban(section, rows, section.dataset.kanbanStage);
}

function enhance() {
  queued = false;
  if (matchMedia('(min-width: 900px)').matches) return;

  const headings = [...document.querySelectorAll('section > h2')].filter((h) => visible(h) && h.textContent.trim() === 'My Leads');
  headings.forEach((heading) => {
    const section = heading.parentElement;
    if (!section) return;
    section.classList.add('engage-salesman-leads-section');

    let toggle = section.querySelector('.engage-salesman-leads-view-toggle');
    if (!toggle) {
      toggle = document.createElement('div');
      toggle.className = 'engage-salesman-leads-view-toggle';
      toggle.setAttribute('role', 'group');
      toggle.setAttribute('aria-label', 'Lead view');

      const list = document.createElement('button');
      list.type = 'button'; list.dataset.mode = 'list'; list.title = 'List view'; list.setAttribute('aria-label', 'List view'); list.innerHTML = LIST_ICON;
      const board = document.createElement('button');
      board.type = 'button'; board.dataset.mode = 'kanban'; board.title = 'Kanban view'; board.setAttribute('aria-label', 'Kanban view'); board.innerHTML = BOARD_ICON;
      list.addEventListener('click', () => setMode(section, 'list'));
      board.addEventListener('click', () => setMode(section, 'kanban'));
      toggle.append(list, board);
      section.appendChild(toggle);
    }

    const mode = section.dataset.leadsView || 'list';
    setMode(section, mode);
  });
}

function queue() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => requestAnimationFrame(enhance));
}

observer = new MutationObserver(queue);
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
window.addEventListener('resize', queue);
window.addEventListener('focus', queue);
setTimeout(queue, 100);
