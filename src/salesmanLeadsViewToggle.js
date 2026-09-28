import './salesman-leads-view-toggle.css';
import { api, mapLeadRow } from './api.js';

const STAGES = ['Cold', 'Conversation', 'Hot', 'Demo', 'Negotiation', 'Won', 'Lost', 'Nurture'];
const LIST_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>';
const BOARD_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="10" rx="1"/></svg>';

let observer = null;
let queued = false;
let apiLeads = [];
let apiLeadsPromise = null;

function visible(node) {
  if (!node || !node.isConnected || node.closest('[hidden]')) return false;
  const style = getComputedStyle(node);
  return style.display !== 'none' && style.visibility !== 'hidden' && node.getClientRects().length > 0;
}

function getLeadRows(section) {
  return [...section.querySelectorAll('.ft-row')].filter((row) => {
    return !!row.querySelector('.employee-mobile-lead-meta, .employee-mobile-brief-pill, .ft-lead-brief-pill');
  });
}

function formatCompactMoney(value) {
  const n = Number(value) || 0;
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1).replace(/\.0$/, '')}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1).replace(/\.0$/, '')}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function leadInfo(row) {
  const name = [...row.querySelectorAll('div')].find((n) => {
    const style = n.getAttribute('style') || '';
    return style.includes('font-weight: 600') || style.includes('fontWeight: 600');
  })?.textContent?.trim() || row.textContent?.trim().split(/Brief|Cold|Conversation|Hot|Demo|Negotiation|Won|Lost|Nurture/)[0]?.trim() || 'Lead';

  const meta = row.querySelector('.employee-mobile-lead-meta');
  const rowText = row.textContent?.trim() || '';
  const metaText = meta?.textContent?.trim() || rowText;
  const stage = meta?.querySelector('span')?.textContent?.trim() || STAGES.find((s) => rowText.includes(s)) || 'Cold';
  const attention = metaText.replace(stage, '').replace(/^\s*·\s*/, '') || '';
  return { name, stage, attention };
}

function selectedFilterStage(section) {
  const select = section.querySelector('select[aria-label="Lead status"]');
  if (!select || select.value === 'all') return null;
  const label = select.options[select.selectedIndex]?.textContent?.trim();
  return STAGES.includes(label) ? label : null;
}

async function loadApiLeads(force = false) {
  if (!force && apiLeads.length) return apiLeads;
  if (!force && apiLeadsPromise) return apiLeadsPromise;
  apiLeadsPromise = api.salesmanLeads()
    .then((result) => {
      const rows = Array.isArray(result?.leads) ? result.leads : Array.isArray(result) ? result : [];
      apiLeads = rows.map(mapLeadRow);
      return apiLeads;
    })
    .finally(() => { apiLeadsPromise = null; });
  return apiLeadsPromise;
}

function stageValuesFromApi() {
  return Object.fromEntries(STAGES.map((stage) => {
    const key = stage.toLowerCase();
    const total = apiLeads
      .filter((lead) => lead.status === key)
      .reduce((sum, lead) => sum + (Number(lead.dealValue) || 0), 0);
    return [stage, total];
  }));
}

function buildKanban(section, rows, selectedStage) {
  let board = section.querySelector('.engage-salesman-kanban');
  const isNewBoard = !board;
  if (!board) {
    board = document.createElement('div');
    board.className = 'engage-salesman-kanban';
  }

  const items = rows.map((row) => ({ row, ...leadInfo(row) }));
  const counts = Object.fromEntries(STAGES.map((s) => [s, items.filter((x) => x.stage === s).length]));
  const values = stageValuesFromApi();
  const filterStage = selectedFilterStage(section);
  const active = filterStage || (STAGES.includes(selectedStage) ? selectedStage : (STAGES.find((s) => counts[s] > 0) || 'Conversation'));
  section.dataset.kanbanStage = active;

  const signature = JSON.stringify({
    active,
    filterStage,
    values,
    items: items.map(({ name, stage, attention }) => [name, stage, attention]),
  });
  if (!isNewBoard && board.dataset.signature === signature) return;
  board.dataset.signature = signature;
  board.innerHTML = '';

  const stages = document.createElement('div');
  stages.className = 'engage-salesman-kanban-stages';
  stages.setAttribute('role', 'tablist');
  stages.setAttribute('aria-label', 'Deal stages');
  STAGES.forEach((stage) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.stage = stage.toLowerCase();
    btn.className = `engage-salesman-kanban-stage${stage === active ? ' is-active' : ''}`;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', String(stage === active));
    btn.innerHTML = `${stage}<span class="engage-salesman-kanban-stage-count">${counts[stage] || 0}</span>`;
    btn.addEventListener('click', () => buildKanban(section, rows, stage));
    stages.appendChild(btn);
  });
  board.appendChild(stages);

  requestAnimationFrame(() => {
    const activeButton = stages.querySelector('.engage-salesman-kanban-stage.is-active');
    activeButton?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  });

  const column = document.createElement('div');
  column.className = 'engage-salesman-kanban-column';
  column.dataset.stage = active.toLowerCase();
  const head = document.createElement('div');
  head.className = 'engage-salesman-kanban-column-head';
  head.innerHTML = `<span>${active}</span><span>${counts[active] || 0} deal${counts[active] === 1 ? '' : 's'} · ${formatCompactMoney(values[active])}</span>`;
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
    if (isNewBoard) listContainer.insertAdjacentElement('afterend', board);
  }
}

async function setMode(section, mode) {
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

  // Source of truth for money is now the same central path as the rest of the
  // app: backend /salesman/leads -> mapLeadRow() -> lead.dealValue. Never infer
  // money from rendered text.
  try {
    await loadApiLeads(true);
  } catch {
    apiLeads = [];
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
