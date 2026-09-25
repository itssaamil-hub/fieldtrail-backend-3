import { api, getSession } from './api.js';

const SHEET_ID = 'engage-admin-team-activity-sheet';
const PHONE_MAX = 900;
let boundCard = null;

function rawName(row) {
  return row?.full_name || row?.fullName || row?.name || 'Employee';
}

function rawId(row) {
  return row?.id || row?.user_id || row?.userId || '';
}

function valueOf(row, keys) {
  for (const key of keys) {
    if (row?.[key] != null && row[key] !== '') return row[key];
  }
  return null;
}

function isSameISTDay(value) {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(d) === fmt.format(new Date());
}

function timeIST(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' }).format(d);
}

function relativeTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const mins = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function leadSalesmanId(lead) {
  return lead?.salesman_id || lead?.salesmanId || lead?.assigned_to || lead?.assignedTo || '';
}

function leadCreatedAt(lead) {
  return lead?.created_at || lead?.createdAt || null;
}

function leadFollowUp(lead) {
  return lead?.next_follow_up_date || lead?.nextFollowUpDate || null;
}

function taskSalesmanId(task) {
  return task?.salesman_id || task?.salesmanId || task?.assigned_to || task?.assignedTo || task?.assignee_id || task?.assigneeId || '';
}

function taskDue(task) {
  return task?.due_at || task?.dueAt || task?.due_date || task?.dueDate || null;
}

function taskOpen(task) {
  const status = String(task?.status || '').toLowerCase();
  return !['completed', 'done', 'cancelled', 'canceled'].includes(status);
}

function statusFor(row) {
  const online = String(valueOf(row, ['status', 'presence_status', 'presenceStatus']) || '').toLowerCase() === 'online';
  const started = valueOf(row, ['day_started_at', 'dayStartedAt', 'started_at', 'startedAt', 'start_day_at', 'startDayAt']);
  const ended = valueOf(row, ['day_ended_at', 'dayEndedAt', 'ended_at', 'endedAt', 'end_day_at', 'endDayAt']);
  if (online) return { key: 'active', label: 'Active now' };
  if (ended && isSameISTDay(ended)) return { key: 'ended', label: 'Day ended' };
  if (started && isSameISTDay(started)) return { key: 'offline', label: 'Offline' };
  return { key: 'not-started', label: 'Not started' };
}

function buildEmployee(row, leads, tasks) {
  const id = rawId(row);
  const employeeLeads = leads.filter(lead => String(leadSalesmanId(lead)) === String(id));
  const todayLeads = employeeLeads.filter(lead => isSameISTDay(leadCreatedAt(lead))).length;
  const followups = employeeLeads.filter(lead => isSameISTDay(leadFollowUp(lead))).length;
  const employeeTasks = tasks.filter(task => String(taskSalesmanId(task)) === String(id) && taskOpen(task));
  const dueToday = employeeTasks.filter(task => isSameISTDay(taskDue(task))).length;
  const overdue = employeeTasks.filter(task => {
    const due = taskDue(task);
    if (!due) return false;
    const d = new Date(due);
    return !Number.isNaN(d.getTime()) && d.getTime() < Date.now() && !isSameISTDay(due);
  }).length;
  const latestLead = [...employeeLeads].sort((a, b) => new Date(leadCreatedAt(b) || 0) - new Date(leadCreatedAt(a) || 0))[0];
  const started = valueOf(row, ['day_started_at', 'dayStartedAt', 'started_at', 'startedAt', 'start_day_at', 'startDayAt']);
  const ended = valueOf(row, ['day_ended_at', 'dayEndedAt', 'ended_at', 'endedAt', 'end_day_at', 'endDayAt']);
  const locationAt = valueOf(row, ['last_location_at', 'lastLocationAt', 'location_updated_at', 'locationUpdatedAt', 'last_seen_at', 'lastSeenAt']);
  return {
    id,
    name: rawName(row),
    area: valueOf(row, ['area', 'territory']) || 'Sales Executive',
    status: statusFor(row),
    started,
    ended,
    locationAt,
    todayLeads,
    followups,
    dueToday,
    overdue,
    lastActivityAt: valueOf(row, ['last_activity_at', 'lastActivityAt', 'last_seen_at', 'lastSeenAt']) || leadCreatedAt(latestLead),
  };
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}

function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || '?';
}

function employeeCard(emp) {
  const startLine = emp.status.key === 'ended'
    ? `<span>Ended day</span><strong>${escapeHtml(timeIST(emp.ended))}</strong>`
    : emp.status.key === 'not-started'
      ? '<span>Day status</span><strong>Not started today</strong>'
      : `<span>Started</span><strong>${escapeHtml(timeIST(emp.started))}</strong>`;
  return `
    <article class="engage-team-employee-card" data-status="${emp.status.key}">
      <div class="engage-team-employee-top">
        <div class="engage-team-avatar">${escapeHtml(initials(emp.name))}</div>
        <div class="engage-team-employee-name-wrap">
          <div class="engage-team-employee-name">${escapeHtml(emp.name)}</div>
          <div class="engage-team-employee-role">${escapeHtml(emp.area)}</div>
        </div>
        <span class="engage-team-status">${escapeHtml(emp.status.label)}</span>
      </div>
      <div class="engage-team-meta-grid">
        <div class="engage-team-meta">${startLine}</div>
        <div class="engage-team-meta"><span>Last location</span><strong>${escapeHtml(relativeTime(emp.locationAt))}</strong></div>
      </div>
      <div class="engage-team-metrics">
        <div><strong>${emp.todayLeads}</strong><span>Leads today</span></div>
        <div><strong>${emp.followups}</strong><span>Follow-ups</span></div>
        <div><strong>${emp.dueToday}</strong><span>Tasks due</span></div>
        <div class="${emp.overdue ? 'is-alert' : ''}"><strong>${emp.overdue}</strong><span>Overdue</span></div>
      </div>
      <div class="engage-team-last-activity"><span>Last activity</span><strong>${escapeHtml(relativeTime(emp.lastActivityAt))}</strong></div>
    </article>`;
}

function renderList(sheet, employees, query = '') {
  const list = sheet.querySelector('.engage-team-list');
  if (!list) return;
  const q = query.trim().toLowerCase();
  const visible = q ? employees.filter(emp => emp.name.toLowerCase().includes(q)) : employees;
  list.innerHTML = visible.length ? visible.map(employeeCard).join('') : '<div class="engage-team-empty">No employees found.</div>';
}

function createSheet() {
  let sheet = document.getElementById(SHEET_ID);
  if (sheet) return sheet;
  sheet = document.createElement('div');
  sheet.id = SHEET_ID;
  sheet.className = 'engage-team-sheet-backdrop';
  sheet.innerHTML = `
    <section class="engage-team-sheet" role="dialog" aria-modal="true" aria-label="Team Activity">
      <div class="engage-team-handle"></div>
      <div class="engage-team-sheet-head">
        <div><h2>Team Activity</h2><p class="engage-team-summary-text">Loading team status…</p></div>
        <button type="button" class="engage-team-close" aria-label="Close">×</button>
      </div>
      <div class="engage-team-summary-cards"></div>
      <div class="engage-team-search-wrap"><span>⌕</span><input type="search" placeholder="Search employee…" aria-label="Search employee" /></div>
      <div class="engage-team-list"><div class="engage-team-empty">Loading…</div></div>
    </section>`;
  document.body.appendChild(sheet);
  const close = () => sheet.remove();
  sheet.querySelector('.engage-team-close')?.addEventListener('click', close);
  sheet.addEventListener('click', event => { if (event.target === sheet) close(); });
  document.addEventListener('keydown', function onKey(event) {
    if (event.key === 'Escape' && document.getElementById(SHEET_ID)) {
      close();
      document.removeEventListener('keydown', onKey);
    }
  });
  return sheet;
}

async function openSheet() {
  if (getSession()?.role !== 'admin' || window.innerWidth > PHONE_MAX) return;
  const sheet = createSheet();
  try {
    const [salesmenRes, leadsRes, tasksRes] = await Promise.all([
      api.adminSalesmen(),
      api.adminLeads(),
      api.tasks({ filter: 'all' }).catch(() => ({ tasks: [] })),
    ]);
    const employees = (salesmenRes?.salesmen || []).map(row => buildEmployee(row, leadsRes?.leads || [], tasksRes?.tasks || []));
    const counts = employees.reduce((acc, emp) => { acc[emp.status.key] = (acc[emp.status.key] || 0) + 1; return acc; }, {});
    sheet.querySelector('.engage-team-summary-text').textContent = `${employees.length} Employees · ${counts.active || 0} Active now`;
    sheet.querySelector('.engage-team-summary-cards').innerHTML = `
      <div data-tone="active"><strong>${counts.active || 0}</strong><span>Active now</span></div>
      <div data-tone="ended"><strong>${counts.ended || 0}</strong><span>Day ended</span></div>
      <div data-tone="not-started"><strong>${counts['not-started'] || 0}</strong><span>Not started</span></div>
      <div data-tone="offline"><strong>${counts.offline || 0}</strong><span>Offline</span></div>`;
    renderList(sheet, employees);
    sheet.querySelector('input[type="search"]')?.addEventListener('input', event => renderList(sheet, employees, event.target.value));
  } catch (err) {
    sheet.querySelector('.engage-team-summary-text').textContent = 'Could not load team activity';
    sheet.querySelector('.engage-team-list').innerHTML = `<div class="engage-team-empty">${escapeHtml(err?.message || 'Please try again.')}</div>`;
  }
}

function findTotalEmployeesCard() {
  return [...document.querySelectorAll('.engage-dashboard-stat')].find(card => {
    const label = card.querySelector('.engage-dashboard-stat-label')?.textContent?.trim().toLowerCase();
    return label === 'total employees';
  }) || null;
}

function sync() {
  if (getSession()?.role !== 'admin' || window.innerWidth > PHONE_MAX) {
    if (boundCard) {
      boundCard.removeEventListener('click', openSheet);
      boundCard.classList.remove('engage-team-card-clickable');
      boundCard = null;
    }
    document.getElementById(SHEET_ID)?.remove();
    return;
  }
  const card = findTotalEmployeesCard();
  if (!card || card === boundCard) return;
  if (boundCard) boundCard.removeEventListener('click', openSheet);
  boundCard = card;
  card.classList.add('engage-team-card-clickable');
  card.addEventListener('click', openSheet);
}

const observer = new MutationObserver(() => requestAnimationFrame(sync));
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('resize', sync);
window.addEventListener('focus', sync);
window.addEventListener('load', sync);
requestAnimationFrame(sync);
