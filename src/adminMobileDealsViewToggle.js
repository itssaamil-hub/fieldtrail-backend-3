const STAGES = ['Cold', 'Conversation', 'Hot', 'Demo', 'Negotiation', 'Won', 'Lost', 'Nurture'];
const LIST_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>';
const BOARD_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="10" rx="1"/></svg>';

let queued = false;

function visible(node) {
  if (!node || !node.isConnected || node.closest('[hidden]')) return false;
  const style = getComputedStyle(node);
  return style.display !== 'none' && style.visibility !== 'hidden' && node.getClientRects().length > 0;
}

function formatCompactMoney(value) {
  const n = Number(value) || 0;
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1).replace(/\.0$/, '')}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1).replace(/\.0$/, '')}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function parseMoney(text) {
  const raw = String(text || '').replace(/,/g, '').trim();
  const match = raw.match(/₹\s*([0-9.]+)\s*(Cr|L|K)?/i);
  if (!match) return 0;
  const base = Number(match[1]) || 0;
  const unit = String(match[2] || '').toLowerCase();
  if (unit === 'cr') return base * 1e7;
  if (unit === 'l') return base * 1e5;
  if (unit === 'k') return base * 1e3;
  return base;
}

function dealRows(section) {
  return [...section.querySelectorAll(':scope > div > .ft-row, :scope .ft-row')]
    .filter((row, index, rows) => rows.indexOf(row) === index)
    .filter((row) => row.tagName === 'BUTTON' && !row.closest('.engage-admin-mobile-kanban'));
}

function dealInfo(row) {
  const text = row.textContent || '';
  const stage = STAGES.find((name) => {
    const spans = [...row.querySelectorAll('span')];
    return spans.some((span) => span.textContent?.trim() === name);
  }) || STAGES.find((name) => text.includes(name)) || 'Cold';

  const divs = [...row.querySelectorAll('div')];
  const name = divs.find((node) => {
    const value = node.textContent?.trim();
    if (!value || value.length > 120) return false;
    const style = node.getAttribute('style') || '';
    return style.includes('font-weight: 700') || style.includes('fontWeight: 700');
  })?.textContent?.trim() || 'Deal';

  const valueNode = divs.find((node) => {
    const style = node.getAttribute('style') || '';
    return (style.includes('font-weight: 850') || style.includes('fontWeight: 850')) && /₹/.test(node.textContent || '');
  });
  const value = parseMoney(valueNode?.textContent || '');

  const metaCandidates = divs
    .map((node) => node.textContent?.trim())
    .filter((value) => value && value !== name && value.length < 120 && !/₹/.test(value));
  const meta = metaCandidates.find((value) => !STAGES.includes(value) && value !== stage) || '';

  return { row, name, stage, value, meta };
}

function selectedStatus(section) {
  const select = section.querySelector('select[aria-label="Deal status"]');
  if (!select || select.value === 'all') return null;
  const label = select.options[select.selectedIndex]?.textContent?.trim();
  return STAGES.includes(label) ? label : null;
}

function setListVisibility(section, show) {
  dealRows(section).forEach((row) => {
    row.style.display = show ? '' : 'none';
  });
}

function boardAnchor(section, rows) {
  const listContainer = rows[0]?.parentElement;
  if (listContainer) return { node: listContainer, position: 'beforebegin' };

  const sortControl = section.querySelector('select[aria-label="Sort deals"]');
  const filterGrid = sortControl?.parentElement;
  if (filterGrid) {
    const resetRow = filterGrid.nextElementSibling;
    const hasResetButton = resetRow?.querySelector?.('button')?.textContent?.trim() === 'Reset filters';
    return { node: hasResetButton ? resetRow : filterGrid, position: 'afterend' };
  }

  const toggleRow = section.querySelector('.engage-admin-mobile-view-toggle-row');
  const addButton = section.querySelector('button[aria-label="Add Deal"]');
  const headerRow = addButton?.parentElement;
  if (toggleRow && headerRow && toggleRow.parentElement === headerRow) return { node: headerRow, position: 'afterend' };
  return toggleRow ? { node: toggleRow, position: 'afterend' } : null;
}

function buildBoard(section, requestedStage) {
  const rows = dealRows(section);
  const items = rows.map(dealInfo);
  const filterStage = selectedStatus(section);
  const counts = Object.fromEntries(STAGES.map((stage) => [stage, items.filter((item) => item.stage === stage).length]));
  const values = Object.fromEntries(STAGES.map((stage) => [stage, items.filter((item) => item.stage === stage).reduce((sum, item) => sum + item.value, 0)]));
  const active = filterStage || (STAGES.includes(requestedStage) ? requestedStage : STAGES.find((stage) => counts[stage] > 0) || 'Conversation');
  section.dataset.adminKanbanStage = active;

  let board = section.querySelector('.engage-admin-mobile-kanban');
  if (!board) {
    board = document.createElement('div');
    board.className = 'engage-admin-mobile-kanban engage-salesman-kanban';
    const anchor = boardAnchor(section, rows);
    anchor?.node?.insertAdjacentElement(anchor.position, board);
  }

  const signature = JSON.stringify({ active, filterStage, counts, values, items: items.map((item) => [item.name, item.stage, item.value, item.meta]) });
  if (board.dataset.signature === signature) return;
  board.dataset.signature = signature;
  board.innerHTML = '';

  const stages = document.createElement('div');
  stages.className = 'engage-salesman-kanban-stages';
  stages.setAttribute('role', 'tablist');
  stages.setAttribute('aria-label', 'Deal stages');
  STAGES.forEach((stage) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.stage = stage.toLowerCase();
    button.className = `engage-salesman-kanban-stage${stage === active ? ' is-active' : ''}`;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(stage === active));
    button.innerHTML = `${stage}<span class="engage-salesman-kanban-stage-count">${counts[stage] || 0}</span>`;
    button.addEventListener('click', () => buildBoard(section, stage));
    stages.appendChild(button);
  });
  board.appendChild(stages);

  const column = document.createElement('div');
  column.className = 'engage-salesman-kanban-column';
  column.dataset.stage = active.toLowerCase();
  const head = document.createElement('div');
  head.className = 'engage-salesman-kanban-column-head';
  head.innerHTML = `<span>${active}</span><span>${counts[active] || 0} deal${counts[active] === 1 ? '' : 's'} · ${formatCompactMoney(values[active])}</span>`;
  column.appendChild(head);

  const stageItems = items.filter((item) => item.stage === active);
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
      card.innerHTML = '<div class="engage-salesman-kanban-card-name"></div><div class="engage-salesman-kanban-card-meta"></div>';
      card.querySelector('.engage-salesman-kanban-card-name').textContent = item.name;
      const meta = [item.meta, item.value ? formatCompactMoney(item.value) : ''].filter(Boolean).join(' · ');
      card.querySelector('.engage-salesman-kanban-card-meta').textContent = meta || item.stage;
      card.addEventListener('click', () => item.row.click());
      column.appendChild(card);
    });
  }
  board.appendChild(column);

  setListVisibility(section, false);
  requestAnimationFrame(() => {
    stages.querySelector('.is-active')?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  });
}

function setMode(section, mode) {
  section.dataset.adminDealsView = mode;
  const row = section.querySelector('.engage-admin-mobile-view-toggle-row');
  row?.querySelectorAll('button[data-mode]').forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  if (mode === 'list') {
    section.querySelector('.engage-admin-mobile-kanban')?.remove();
    setListVisibility(section, true);
    return;
  }
  buildBoard(section, section.dataset.adminKanbanStage);
}

function placeToggleBesideAddDeal(section, row) {
  const addButton = section.querySelector('button[aria-label="Add Deal"]');
  const headerRow = addButton?.parentElement;
  if (!addButton || !headerRow) return false;

  Object.assign(row.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    margin: '0 0 0 auto',
    flexShrink: '0',
  });
  headerRow.insertBefore(row, addButton);
  return true;
}

function enhanceSection(section) {
  if (!visible(section)) return;
  section.classList.add('engage-salesman-leads-section');

  let row = section.querySelector('.engage-admin-mobile-view-toggle-row');
  if (!row) {
    row = document.createElement('div');
    row.className = 'engage-admin-mobile-view-toggle-row';

    const toggle = document.createElement('div');
    toggle.className = 'engage-salesman-leads-view-toggle';
    Object.assign(toggle.style, { position: 'static', top: 'auto', right: 'auto' });
    toggle.setAttribute('role', 'group');
    toggle.setAttribute('aria-label', 'Deal view');

    const list = document.createElement('button');
    list.type = 'button';
    list.dataset.mode = 'list';
    list.title = 'List view';
    list.setAttribute('aria-label', 'List view');
    list.innerHTML = LIST_ICON;

    const board = document.createElement('button');
    board.type = 'button';
    board.dataset.mode = 'kanban';
    board.title = 'Kanban view';
    board.setAttribute('aria-label', 'Kanban view');
    board.innerHTML = BOARD_ICON;

    list.addEventListener('click', () => setMode(section, 'list'));
    board.addEventListener('click', () => setMode(section, 'kanban'));
    toggle.append(list, board);
    row.appendChild(toggle);
  }

  if (!placeToggleBesideAddDeal(section, row) && !row.isConnected) {
    const filterGrid = section.querySelector('select[aria-label="Employee"]')?.parentElement;
    if (filterGrid) filterGrid.insertAdjacentElement('afterend', row);
    else section.querySelector('h2')?.parentElement?.parentElement?.insertAdjacentElement('afterend', row);
  }

  const mode = section.dataset.adminDealsView || 'list';
  setMode(section, mode);
}

function enhance() {
  queued = false;
  if (matchMedia('(min-width: 900px)').matches) return;
  document.querySelectorAll('section[aria-label="Admin deals"]').forEach(enhanceSection);
}

function queue() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => requestAnimationFrame(enhance));
}

const observer = new MutationObserver(queue);
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
window.addEventListener('resize', queue);
window.addEventListener('focus', queue);
setTimeout(queue, 100);
