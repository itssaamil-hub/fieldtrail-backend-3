import { getApiBase, getSession } from './api.js';

const ROOT_CLASS = 'engage-employee-panel-enhanced';
const PAGE_SIZE = 8;
let roster = [];
let briefs = new Map();
let loaded = false;
let loading = false;
let currentPage = 1;

function istToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

function fmtTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true
  }).format(d);
}

function norm(value) {
  return String(value || '').trim().toLowerCase();
}

function findPanel() {
  const cards = [...document.querySelectorAll('.ft-card')];
  return cards.find((card) => {
    const first = card.firstElementChild;
    return first && /\bEmployees\b/.test(first.textContent || '') && card.querySelector('button');
  }) || null;
}

function employeeCards(panel) {
  return [...panel.children].filter((node) =>
    node.querySelector?.('button') && /View route/i.test(node.textContent || '') && /Settings/i.test(node.textContent || '')
  );
}

async function loadData() {
  if (loading || loaded) return;
  const base = getApiBase();
  const token = getSession()?.token;
  if (!base || !token) return;
  loading = true;
  try {
    const rosterRes = await fetch(`${base}/admin/salesmen`, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store'
    });
    if (!rosterRes.ok) throw new Error('Could not load employees');
    roster = (await rosterRes.json()).salesmen || [];

    const day = istToday();
    const results = await Promise.all(roster.map(async (person) => {
      try {
        const res = await fetch(`${base}/admin/salesmen/${encodeURIComponent(person.id)}/brief?date=${day}`, {
          headers: { Authorization: `Bearer ${token}` }, cache: 'no-store'
        });
        if (!res.ok) return [person.id, null];
        return [person.id, await res.json()];
      } catch {
        return [person.id, null];
      }
    }));
    briefs = new Map(results);
    loaded = true;
    queueEnhance();
  } finally {
    loading = false;
  }
}

function employeeForCard(card) {
  const text = norm(card.textContent);
  return roster.find((person) => text.includes(norm(person.full_name || person.name))) || null;
}

function statusFor(person, brief) {
  const status = norm(person?.status);
  if (status === 'online') return 'online';
  const sessions = brief?.sessions || [];
  if (!sessions.length) return 'not-started';
  return 'offline';
}

function ensureControls(panel) {
  let controls = panel.querySelector(':scope > .engage-employee-controls');
  if (controls) return controls;
  controls = document.createElement('div');
  controls.className = 'engage-employee-controls';
  controls.innerHTML = `
    <div class="engage-employee-search-wrap">
      <span aria-hidden="true">⌕</span>
      <input type="search" class="engage-employee-search" placeholder="Search employees" aria-label="Search employees">
    </div>
    <div class="engage-employee-filter" role="group" aria-label="Employee status filter">
      <button type="button" data-status="all" class="is-active">All</button>
      <button type="button" data-status="online">Online</button>
      <button type="button" data-status="offline">Offline</button>
      <button type="button" data-status="not-started">Not started</button>
    </div>`;
  panel.children[0]?.insertAdjacentElement('afterend', controls);
  controls.querySelector('input')?.addEventListener('input', () => { currentPage = 1; applyFilters(panel); });
  controls.querySelectorAll('[data-status]').forEach((button) => button.addEventListener('click', () => {
    controls.querySelectorAll('[data-status]').forEach((b) => b.classList.remove('is-active'));
    button.classList.add('is-active');
    currentPage = 1;
    applyFilters(panel);
  }));
  return controls;
}

function ensureToday(card, brief) {
  let today = card.querySelector('.engage-employee-today');
  if (!today) {
    today = document.createElement('div');
    today.className = 'engage-employee-today';
    const progress = [...card.querySelectorAll('*')].find((node) => node.children.length === 0 && node.textContent?.trim() === 'This month')?.parentElement?.parentElement;
    if (progress) card.insertBefore(today, progress);
    else {
      const actions = [...card.querySelectorAll('button')].find((b) => /View route/i.test(b.textContent || ''))?.parentElement;
      if (actions) card.insertBefore(today, actions);
      else card.appendChild(today);
    }
  }

  if (!brief) {
    today.textContent = 'Today · Activity unavailable';
    return;
  }
  const firstSession = brief.sessions?.[0];
  const started = firstSession?.startedAt ? `Started ${fmtTime(firstSession.startedAt)}` : 'Not started';
  const leads = Number(brief.glance?.leadsAdded || 0);
  const followups = Number(brief.followUpHealth?.dueToday || 0);
  const tasks = Number(brief.unfinished?.pendingTasks || 0);
  today.innerHTML = `<strong>Today</strong><span>${started} · ${leads} lead${leads === 1 ? '' : 's'} · ${followups} follow-up${followups === 1 ? '' : 's'} · ${tasks} task${tasks === 1 ? '' : 's'}</span>`;
}

function clarifyMonthlyProgress(card) {
  const month = [...card.querySelectorAll('*')].find((node) => node.children.length === 0 && node.textContent?.trim() === 'This month');
  if (!month) return;
  const block = month.parentElement;
  if (!block) return;
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const text = (node.nodeValue || '').trim();
    if (/^\d+\s*\/\s*\d+$/.test(text)) {
      node.nodeValue = `${text} leads`;
      break;
    }
  }
}

function ensurePagination(panel, visibleCards) {
  panel.querySelector(':scope > .engage-employee-pagination')?.remove();
  if (visibleCards.length <= PAGE_SIZE) {
    visibleCards.forEach((card) => { card.hidden = false; });
    return;
  }
  const pages = Math.ceil(visibleCards.length / PAGE_SIZE);
  currentPage = Math.min(currentPage, pages);
  visibleCards.forEach((card, index) => {
    card.hidden = !(index >= (currentPage - 1) * PAGE_SIZE && index < currentPage * PAGE_SIZE);
  });
  const pagination = document.createElement('div');
  pagination.className = 'engage-employee-pagination';
  pagination.innerHTML = `<span>${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, visibleCards.length)} of ${visibleCards.length}</span><div><button type="button" data-prev ${currentPage === 1 ? 'disabled' : ''}>Previous</button><button type="button" data-next ${currentPage === pages ? 'disabled' : ''}>Next</button></div>`;
  panel.appendChild(pagination);
  pagination.querySelector('[data-prev]')?.addEventListener('click', () => { currentPage -= 1; applyFilters(panel); });
  pagination.querySelector('[data-next]')?.addEventListener('click', () => { currentPage += 1; applyFilters(panel); });
}

function applyFilters(panel) {
  const controls = ensureControls(panel);
  const query = norm(controls.querySelector('.engage-employee-search')?.value);
  const selected = controls.querySelector('[data-status].is-active')?.dataset.status || 'all';
  const cards = employeeCards(panel);
  const visible = [];

  cards.forEach((card) => {
    const person = employeeForCard(card);
    const brief = person ? briefs.get(person.id) : null;
    const status = statusFor(person, brief);
    card.classList.toggle('engage-employee-online-card', status === 'online');
    card.dataset.employeeStatus = status;
    if (brief) ensureToday(card, brief);
    clarifyMonthlyProgress(card);

    const matchesSearch = !query || norm(person?.full_name || card.textContent).includes(query) || norm(person?.employee_code).includes(query) || norm(person?.area).includes(query);
    const matchesStatus = selected === 'all' || status === selected;
    const show = matchesSearch && matchesStatus;
    card.hidden = !show;
    if (show) visible.push(card);
  });

  ensurePagination(panel, visible);
}

function enhance() {
  const panel = findPanel();
  if (!panel) return;
  panel.classList.add(ROOT_CLASS);
  ensureControls(panel);
  applyFilters(panel);
  loadData();
}

let queued = false;
function queueEnhance() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    enhance();
  });
}

const observer = new MutationObserver(queueEnhance);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('load', queueEnhance);
window.addEventListener('resize', queueEnhance);
requestAnimationFrame(queueEnhance);
