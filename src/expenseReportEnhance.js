import { getApiBase, getSession } from './api.js';

const ROOT_CLASS = 'engage-expense-report';
let latestExpenses = [];
let latestMonthTotal = 0;
let latestKey = '';
let fetching = false;

function findExpenseRoot() {
  const categorySelect = [...document.querySelectorAll('select')].find((select) =>
    [...select.options].some((option) => option.textContent?.trim() === 'All categories')
  );
  if (!categorySelect) return null;
  const filters = categorySelect.parentElement;
  const root = filters?.parentElement;
  if (!root) return null;
  return { root, filters, categorySelect };
}

function formatExpenseDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return raw;
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return raw.replace(/\s+00:00:00.*$/, '');
  const [, y, m, d] = match;
  const date = new Date(`${y}-${m}-${d}T12:00:00+05:30`);
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(date);
}

function isoDay(value) {
  const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] || '';
}

function istDay(offset = 0) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(Date.now() + offset * 86400000));
  const obj = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${obj.year}-${obj.month}-${obj.day}`;
}

function groupLabel(value) {
  const day = isoDay(value);
  if (!day) return 'Other';
  if (day === istDay()) return 'Today';
  if (day === istDay(-1)) return 'Yesterday';
  return formatExpenseDate(day);
}

function money(n) {
  const value = Number(n || 0);
  if (value >= 1e7) return `₹${(value / 1e7).toFixed(1)}Cr`;
  if (value >= 1e5) return `₹${(value / 1e5).toFixed(1)}L`;
  if (value >= 1e3) return `₹${(value / 1e3).toFixed(1)}K`;
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function currentFilterInfo(filters) {
  const selects = filters.querySelectorAll('select');
  const dates = filters.querySelectorAll('input[type="date"]');
  return {
    category: selects[0]?.value || 'all',
    salesmanId: selects[1]?.value || 'all',
    from: dates[0]?.value || '',
    to: dates[1]?.value || '',
  };
}

function makeQuery(values) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value && value !== 'all') params.set(key, value);
  });
  return params.toString();
}

async function apiGetExpenses(values = {}) {
  const base = getApiBase();
  const token = getSession()?.token;
  if (!base || !token) return [];
  const qs = makeQuery(values);
  const response = await fetch(`${base}/admin/expenses${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store'
  });
  if (!response.ok) throw new Error('Could not load expenses');
  return (await response.json()).expenses || [];
}

async function refreshData(found) {
  if (fetching) return;
  const filters = currentFilterInfo(found.filters);
  const key = JSON.stringify(filters);
  if (key === latestKey && latestExpenses.length) return;
  fetching = true;
  try {
    const now = new Date();
    const monthStart = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).format(now) + '-01';
    const [filtered, month] = await Promise.all([
      apiGetExpenses(filters),
      apiGetExpenses({ from: monthStart, to: istDay() }),
    ]);
    latestExpenses = filtered;
    latestMonthTotal = month.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    latestKey = key;
    queueEnhance();
  } catch {
    // Keep the React report usable if this enhancement fetch fails.
  } finally {
    fetching = false;
  }
}

function cleanExpenseRowDate(row) {
  const details = row.querySelector('div > div:nth-child(2)');
  if (!details) return;
  const walker = document.createTreeWalker(details, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    const original = node.nodeValue || '';
    const cleaned = original
      .replace(/\b\d{4}-\d{2}-\d{2}(?:[T\s]00:00:00(?:\.\d+)?Z?)?\b/g, (match) => formatExpenseDate(match))
      .replace(/\s+00:00:00(?=\s*(?:·|$))/g, '');
    if (cleaned !== original) node.nodeValue = cleaned;
  });
}

function summary(root) {
  if (!latestExpenses.length) {
    root.querySelector('.engage-expense-summary')?.remove();
    return;
  }
  let grid = root.querySelector('.engage-expense-summary');
  if (!grid) {
    grid = document.createElement('div');
    grid.className = 'engage-expense-summary';
    const filters = root.querySelector('.engage-expense-filters');
    filters?.insertAdjacentElement('afterend', grid);
  }
  const total = latestExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const byCategory = latestExpenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount || 0);
    return acc;
  }, {});
  const top = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
  grid.innerHTML = `
    <div class="engage-expense-summary-card"><span>Total spend</span><strong>${money(total)}</strong></div>
    <div class="engage-expense-summary-card"><span>This month</span><strong>${money(latestMonthTotal)}</strong></div>
    <div class="engage-expense-summary-card"><span>Top category</span><strong>${top ? top[0] : '—'}</strong></div>
    <div class="engage-expense-summary-card"><span>Entries</span><strong>${latestExpenses.length}</strong></div>`;
}

function removeDateGroups(list) {
  list.querySelectorAll(':scope > .engage-expense-date-group').forEach((n) => n.remove());
}

function addDateGroups(list, rows) {
  removeDateGroups(list);
  let previous = '';
  rows.forEach((row, index) => {
    const item = latestExpenses[index];
    if (!item) return;
    const label = groupLabel(item.spentOn);
    if (label !== previous) {
      const heading = document.createElement('div');
      heading.className = 'engage-expense-date-group';
      heading.textContent = label;
      list.insertBefore(heading, row);
      previous = label;
    }
  });
}

function openEdit(item, found) {
  document.querySelector('.engage-expense-edit-overlay')?.remove();
  const categoryOptions = [...found.filters.querySelectorAll('select')[0].options]
    .filter((o) => o.value !== 'all')
    .map((o) => `<option value="${o.value.replace(/"/g, '&quot;')}">${o.textContent}</option>`).join('');
  const employeeOptions = [...found.filters.querySelectorAll('select')[1].options]
    .map((o) => `<option value="${o.value.replace(/"/g, '&quot;')}">${o.textContent}</option>`).join('');

  const overlay = document.createElement('div');
  overlay.className = 'engage-expense-edit-overlay';
  overlay.innerHTML = `
    <div class="engage-expense-edit-sheet" role="dialog" aria-modal="true" aria-label="Edit expense">
      <div class="engage-expense-edit-head"><div><h3>Edit expense</h3><p>Correct the amount, date, employee or note.</p></div><button type="button" data-close>×</button></div>
      <form>
        <label>Category<select name="category">${categoryOptions}</select></label>
        <label>Amount<input name="amount" type="number" min="0.01" step="0.01" required></label>
        <label>Employee<select name="salesmanId">${employeeOptions}</select></label>
        <label>Date<input name="spentOn" type="date" required></label>
        <label class="engage-expense-edit-note">Note<textarea name="note" rows="3" placeholder="Optional note"></textarea></label>
        <div class="engage-expense-edit-error" hidden></div>
        <div class="engage-expense-edit-actions"><button type="button" data-close>Cancel</button><button type="submit">Save changes</button></div>
      </form>
    </div>`;
  document.body.appendChild(overlay);

  const form = overlay.querySelector('form');
  form.elements.category.value = item.category || '';
  form.elements.amount.value = item.amount ?? '';
  form.elements.salesmanId.value = item.salesmanId || 'all';
  form.elements.spentOn.value = isoDay(item.spentOn);
  form.elements.note.value = item.note || '';

  const close = () => overlay.remove();
  overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const save = form.querySelector('button[type="submit"]');
    const error = form.querySelector('.engage-expense-edit-error');
    save.disabled = true;
    save.textContent = 'Saving…';
    error.hidden = true;
    try {
      const base = getApiBase();
      const token = getSession()?.token;
      const response = await fetch(`${base}/admin/expenses/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          category: form.elements.category.value,
          amount: Number(form.elements.amount.value),
          salesmanId: form.elements.salesmanId.value === 'all' ? null : form.elements.salesmanId.value,
          spentOn: form.elements.spentOn.value,
          note: form.elements.note.value.trim() || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not update expense.');
      close();
      window.location.reload();
    } catch (err) {
      error.textContent = err.message || 'Could not update expense.';
      error.hidden = false;
      save.disabled = false;
      save.textContent = 'Save changes';
    }
  });
}

function enhance() {
  const found = findExpenseRoot();
  if (!found) return;
  const { root, filters } = found;
  root.classList.add(ROOT_CLASS);
  filters.classList.add('engage-expense-filters');

  const children = [...root.children];
  children.forEach((child) => {
    if (child === filters || child.classList.contains('engage-expense-title') || child.classList.contains('engage-expense-summary')) return;
    const text = (child.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.startsWith('Total spend:')) {
      child.classList.add('engage-expense-total');
      return;
    }
    if (child.querySelector?.('button[aria-label="Delete expense"]')) {
      child.classList.add('engage-expense-list');
      const rows = [...child.children].filter((row) => !row.classList.contains('engage-expense-date-group'));
      rows.forEach((row, index) => {
        row.classList.add('engage-expense-row');
        cleanExpenseRowDate(row);
        const item = latestExpenses[index];
        if (item) {
          row.dataset.expenseId = item.id;
          let edit = row.querySelector('.engage-expense-edit');
          if (!edit) {
            edit = document.createElement('button');
            edit.type = 'button';
            edit.className = 'engage-expense-edit';
            edit.setAttribute('aria-label', 'Edit expense');
            edit.title = 'Edit expense';
            edit.innerHTML = '✎';
            const del = row.querySelector('button[aria-label="Delete expense"]');
            del?.parentElement?.insertBefore(edit, del);
            edit.addEventListener('click', (event) => {
              event.stopPropagation();
              openEdit(item, found);
            });
          }
        }
      });
      if (latestExpenses.length) addDateGroups(child, rows);
      return;
    }
    if (child.querySelector?.('div > div[style*="width"]') || (child.children?.length && [...child.children].some((node) => node.querySelector?.('div[style*="height: 8px"]')))) {
      child.classList.add('engage-expense-breakdown');
    }
  });

  if (!root.querySelector('.engage-expense-title')) {
    const title = document.createElement('div');
    title.className = 'engage-expense-title';
    title.innerHTML = '<div><h2>Expenses</h2><p>Track team spending by category, employee and date.</p></div>';
    root.insertBefore(title, filters);
  }

  const dateInputs = filters.querySelectorAll('input[type="date"]');
  dateInputs.forEach((input, index) => {
    input.classList.add('engage-expense-date');
    input.setAttribute('aria-label', index === 0 ? 'Expense from date' : 'Expense to date');
  });

  summary(root);
  refreshData(found);
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
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
window.addEventListener('resize', queueEnhance);
window.addEventListener('load', queueEnhance);
document.addEventListener('change', (event) => {
  if (event.target?.closest?.('.engage-expense-filters')) {
    latestKey = '';
    setTimeout(queueEnhance, 0);
  }
});
requestAnimationFrame(queueEnhance);
