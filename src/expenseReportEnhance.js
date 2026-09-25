import { getApiBase, getSession } from './api.js';

const ROOT_CLASS = 'engage-expense-report';
const PAGE_SIZE = 12;
let latestExpenses = [];
let latestMonthTotal = 0;
let latestKey = '';
let fetching = false;
let visibleCount = PAGE_SIZE;

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

function monthRange(offset = 0) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const obj = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const base = new Date(Number(obj.year), Number(obj.month) - 1 + offset, 1, 12);
  const y = base.getFullYear();
  const m = base.getMonth();
  const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  if (offset === 0) return { from: start, to: istDay() };
  const endDate = new Date(y, m + 1, 0, 12);
  const to = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
  return { from: start, to };
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
    const thisMonth = monthRange(0);
    const [filtered, month] = await Promise.all([
      apiGetExpenses(filters),
      apiGetExpenses(thisMonth),
    ]);
    latestExpenses = filtered;
    latestMonthTotal = month.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    latestKey = key;
    visibleCount = PAGE_SIZE;
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
    <div class="engage-expense-summary-card"><span>Top category</span><strong>${top ? top[0] : '—'}</strong>${top ? `<small>${money(top[1])}</small>` : ''}</div>
    <div class="engage-expense-summary-card"><span>Entries</span><strong>${latestExpenses.length}</strong></div>`;
}

function ensureQuickFilters(found) {
  let quick = found.root.querySelector('.engage-expense-quick-filters');
  if (!quick) {
    quick = document.createElement('div');
    quick.className = 'engage-expense-quick-filters';
    quick.innerHTML = `
      <span>Quick date</span>
      <button type="button" data-range="this">This month</button>
      <button type="button" data-range="last">Last month</button>
      <button type="button" data-range="custom">Custom</button>`;
    found.root.insertBefore(quick, found.filters);
    quick.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-range]');
      if (!button) return;
      const dates = found.filters.querySelectorAll('input[type="date"]');
      if (button.dataset.range === 'this') {
        const range = monthRange(0);
        dates[0].value = range.from;
        dates[1].value = range.to;
      } else if (button.dataset.range === 'last') {
        const range = monthRange(-1);
        dates[0].value = range.from;
        dates[1].value = range.to;
      } else {
        dates[0]?.focus();
        return;
      }
      dates[0]?.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  const { from, to } = currentFilterInfo(found.filters);
  const thisMonth = monthRange(0);
  const lastMonth = monthRange(-1);
  quick.querySelectorAll('button[data-range]').forEach((button) => {
    const range = button.dataset.range;
    const active = range === 'this'
      ? from === thisMonth.from && to === thisMonth.to
      : range === 'last'
        ? from === lastMonth.from && to === lastMonth.to
        : !!(from || to) && !((from === thisMonth.from && to === thisMonth.to) || (from === lastMonth.from && to === lastMonth.to));
    button.classList.toggle('is-active', active);
  });
}

function removeDateGroups(list) {
  list.querySelectorAll(':scope > .engage-expense-date-group').forEach((n) => n.remove());
}

function addDateGroups(list, rows) {
  removeDateGroups(list);
  let previous = '';
  rows.forEach((row, index) => {
    if (index >= visibleCount) return;
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

function applyPagination(list, rows) {
  rows.forEach((row, index) => row.classList.toggle('engage-expense-row-hidden', index >= visibleCount));
  list.querySelector(':scope > .engage-expense-load-more')?.remove();
  if (rows.length > visibleCount) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'engage-expense-load-more';
    button.textContent = `Load more (${rows.length - visibleCount} remaining)`;
    button.addEventListener('click', () => {
      visibleCount += PAGE_SIZE;
      queueEnhance();
    });
    list.appendChild(button);
  }
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

function polishRow(row, item, found) {
  const content = row.children[0];
  if (content) {
    const title = content.children[0];
    const details = content.children[1];
    if (title) {
      title.textContent = item.category || 'Expense';
      title.classList.add('engage-expense-row-title');
    }
    if (details) {
      const bits = [formatExpenseDate(item.spentOn), item.note].filter(Boolean);
      details.textContent = bits.join(' · ');
      details.classList.add('engage-expense-row-meta');
    }
    let badges = content.querySelector('.engage-expense-row-badges');
    if (!badges) {
      badges = document.createElement('div');
      badges.className = 'engage-expense-row-badges';
      content.appendChild(badges);
    }
    badges.innerHTML = item.salesmanName ? `<span>${item.salesmanName}</span>` : '<span>General</span>';
  }

  const del = row.querySelector('button[aria-label="Delete expense"]');
  if (!del) return;
  let actions = row.querySelector('.engage-expense-row-actions');
  if (!actions) {
    actions = document.createElement('div');
    actions.className = 'engage-expense-row-actions';
    row.appendChild(actions);
    actions.appendChild(del);
  }
  let amount = actions.querySelector('.engage-expense-row-amount');
  if (!amount) {
    amount = document.createElement('strong');
    amount.className = 'engage-expense-row-amount';
    actions.insertBefore(amount, actions.firstChild);
  }
  amount.textContent = money(item.amount);

  let edit = actions.querySelector('.engage-expense-edit');
  if (!edit) {
    edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'engage-expense-edit';
    edit.setAttribute('aria-label', 'Edit expense');
    edit.title = 'Edit expense';
    edit.innerHTML = '✎';
    actions.insertBefore(edit, del);
    edit.addEventListener('click', (event) => {
      event.stopPropagation();
      openEdit(item, found);
    });
  }
}

function enhance() {
  const found = findExpenseRoot();
  if (!found) return;
  const { root, filters } = found;
  root.classList.add(ROOT_CLASS);
  filters.classList.add('engage-expense-filters');
  root.querySelector('.engage-expense-title')?.remove();
  ensureQuickFilters(found);

  const children = [...root.children];
  children.forEach((child) => {
    if (child === filters || child.classList.contains('engage-expense-summary') || child.classList.contains('engage-expense-quick-filters')) return;
    const text = (child.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.startsWith('Total spend:')) {
      child.classList.add('engage-expense-total');
      return;
    }
    if (child.querySelector?.('button[aria-label="Delete expense"]')) {
      child.classList.add('engage-expense-list');
      const rows = [...child.children].filter((row) =>
        !row.classList.contains('engage-expense-date-group') && !row.classList.contains('engage-expense-load-more')
      );
      rows.forEach((row, index) => {
        row.classList.add('engage-expense-row');
        cleanExpenseRowDate(row);
        const item = latestExpenses[index];
        if (item) {
          row.dataset.expenseId = item.id;
          polishRow(row, item, found);
        }
      });
      applyPagination(child, rows);
      if (latestExpenses.length) addDateGroups(child, rows);
      return;
    }
    if (child.querySelector?.('div > div[style*="width"]') || (child.children?.length && [...child.children].some((node) => node.querySelector?.('div[style*="height: 8px"]')))) {
      child.classList.add('engage-expense-breakdown');
      const categoryCount = Object.keys(latestExpenses.reduce((acc, e) => { acc[e.category] = true; return acc; }, {})).length;
      child.classList.toggle('engage-expense-breakdown-compact', categoryCount <= 1);
    }
  });

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
    visibleCount = PAGE_SIZE;
    setTimeout(queueEnhance, 0);
  }
});
requestAnimationFrame(queueEnhance);
