import { getApiBase, getSession } from './api.js';

let lastKey = '';
let loading = false;
let cachedRows = [];

const clean = node => (node?.textContent || '').replace(/\s+/g, ' ').trim();
const money = n => {
  const v = Number(n || 0);
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(1)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)}L`;
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(1)}K`;
  return `₹${Math.round(v).toLocaleString('en-IN')}`;
};

function findRoot() {
  const title = [...document.querySelectorAll('h1')].find(el => /Monthly Performance/i.test(clean(el)));
  if (!title) return null;
  return title.closest('.engage-performance-report') || title.parentElement?.parentElement?.parentElement || null;
}

function controls(root) {
  const month = root?.querySelector('input[type="month"]');
  const employee = [...(root?.querySelectorAll('select') || [])].find(s => [...s.options].some(o => /All employees/i.test(o.textContent || '')));
  return { month, employee };
}

async function fetchRows(root) {
  const { month, employee } = controls(root);
  if (!month) return;
  const anchor = month.value ? `${month.value}-01` : '';
  const salesmanId = employee?.value || '';
  const key = `${anchor}|${salesmanId}`;
  if (loading || key === lastKey) return;
  loading = true;
  try {
    const qs = new URLSearchParams({ month: anchor });
    if (salesmanId) qs.set('salesmanId', salesmanId);
    const response = await fetch(`${getApiBase()}/admin/reports/performance-insights?${qs}`, {
      headers: { Authorization: `Bearer ${getSession()?.token || ''}` },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Could not load performance insights');
    cachedRows = (await response.json()).rows || [];
    lastKey = key;
    render(root);
  } catch {
    // Keep the original report fully usable if the new backend route is still deploying.
  } finally {
    loading = false;
  }
}

function managerNotes(r) {
  const notes = [];
  if (r.leadToWonPct >= 15) notes.push({ type: 'good', text: `Strong lead-to-win conversion · ${r.leadToWonPct}%` });
  else if (r.leadsAdded >= 10 && r.leadToWonPct < 5) notes.push({ type: 'warn', text: `Low lead-to-win conversion · ${r.leadToWonPct}%` });
  if (r.overdueFollowUps > 0) notes.push({ type: 'risk', text: `${r.overdueFollowUps} overdue follow-up${r.overdueFollowUps === 1 ? '' : 's'} need attention` });
  if (r.tasksOverdue > 0) notes.push({ type: 'risk', text: `${r.tasksOverdue} overdue task${r.tasksOverdue === 1 ? '' : 's'}` });
  if (r.workingDays > 0 && r.activeDays / r.workingDays < 0.6) notes.push({ type: 'warn', text: `Start Day recorded on ${r.activeDays} of ${r.workingDays} working days` });
  if (r.activeDays > 0 && r.dayClosingSubmitted < r.activeDays) notes.push({ type: 'warn', text: `${r.activeDays - r.dayClosingSubmitted} Day Closing report${r.activeDays - r.dayClosingSubmitted === 1 ? '' : 's'} missing` });
  if (!notes.length) notes.push({ type: 'good', text: 'No immediate performance exceptions in this period' });
  return notes.slice(0, 3);
}

function insightPanel(r) {
  const panel = document.createElement('div');
  panel.className = 'engage-performance-insights';
  panel.innerHTML = `
    <div class="engage-performance-insights-title">Manager view</div>
    <div class="engage-performance-core-metrics">
      <div><span>Follow-ups</span><strong>${r.followUpsCompleted}/${r.followUpsDue}</strong><small>completed / due</small></div>
      <div><span>Overdue</span><strong class="${r.overdueFollowUps ? 'is-risk' : ''}">${r.overdueFollowUps}</strong><small>follow-ups</small></div>
      <div><span>Negotiations</span><strong>${r.negotiations}</strong><small>${r.lost} lost</small></div>
      <div><span>Avg deal</span><strong>${money(r.averageDealValue)}</strong><small>${r.won} won</small></div>
    </div>
    <div class="engage-performance-conversions">
      <span>Lead → Demo <b>${r.leadToDemoPct}%</b></span>
      <span>Demo → Won <b>${r.demoToWonPct}%</b></span>
      <span>Lead → Won <b>${r.leadToWonPct}%</b></span>
    </div>
    <div class="engage-performance-activity-grid">
      <span><b>${r.activeDays}/${r.workingDays}</b> active days</span>
      <span><b>${r.dayClosingSubmitted}/${r.activeDays || 0}</b> day closings</span>
      <span><b>${r.tasksCompleted}</b> tasks done</span>
      <span class="${r.tasksOverdue ? 'is-risk' : ''}"><b>${r.tasksOverdue}</b> overdue tasks</span>
      <span><b>${r.visits}</b> visits</span>
      <span><b>${r.averageLeadsPerActiveDay}</b> leads/day</span>
    </div>
    <div class="engage-performance-manager-notes">
      ${managerNotes(r).map(n => `<div class="is-${n.type}"><i></i>${n.text}</div>`).join('')}
    </div>`;
  return panel;
}

function render(root) {
  root.querySelectorAll('.engage-performance-insights').forEach(n => n.remove());
  const cards = [...root.querySelectorAll('.engage-performance-employee-card')];
  cards.forEach(card => {
    const row = cachedRows.find(r => clean(card).toLowerCase().includes(String(r.name || '').toLowerCase()));
    if (!row) return;
    const panel = insightPanel(row);
    const incentive = card.querySelector('.engage-performance-incentive');
    if (incentive) incentive.insertAdjacentElement('beforebegin', panel);
    else card.appendChild(panel);
  });
}

function enhance() {
  const root = findRoot();
  if (!root) return;
  if (cachedRows.length) render(root);
  fetchRows(root);
}

let queued = false;
function queue() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; enhance(); });
}

const observer = new MutationObserver(queue);
observer.observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener('change', e => {
  const root = findRoot();
  if (!root || !e.target?.closest?.('.engage-performance-report')) return;
  if (e.target.matches('input[type="month"], select')) {
    lastKey = '';
    cachedRows = [];
    setTimeout(queue, 0);
  }
});
window.addEventListener('load', queue);
requestAnimationFrame(queue);
