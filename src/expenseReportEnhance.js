const ROOT_CLASS = 'engage-expense-report';

function findExpenseRoot() {
  const categorySelect = [...document.querySelectorAll('select')].find((select) =>
    [...select.options].some((option) => option.textContent?.trim() === 'All categories')
  );
  if (!categorySelect) return null;
  const filters = categorySelect.parentElement;
  const root = filters?.parentElement;
  if (!root) return null;
  return { root, filters };
}

function formatExpenseDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return raw;

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s]00:00:00(?:\.\d+)?Z?)?$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(`${year}-${month}-${day}T12:00:00Z`);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
    }
  }

  return raw
    .replace(/T00:00:00(?:\.\d+)?Z?/g, '')
    .replace(/\s+00:00:00(?:\.\d+)?(?:\s+GMT[^·]*)?/g, '');
}

function cleanExpenseRowDate(row) {
  const details = row.querySelector('div > div:nth-child(2)');
  if (!details) return;

  const walker = document.createTreeWalker(details, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach((node) => {
    const original = node.nodeValue || '';
    const cleaned = original.replace(
      /\b\d{4}-\d{2}-\d{2}(?:[T\s]00:00:00(?:\.\d+)?Z?)?\b/g,
      (match) => formatExpenseDate(match)
    ).replace(/\s+00:00:00(?=\s*(?:·|$))/g, '');
    if (cleaned !== original) node.nodeValue = cleaned;
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
    if (child === filters) return;
    const text = (child.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.startsWith('Total spend:')) {
      child.classList.add('engage-expense-total');
      return;
    }
    if (child.querySelector?.('button[aria-label="Delete expense"]')) {
      child.classList.add('engage-expense-list');
      [...child.children].forEach((row) => {
        row.classList.add('engage-expense-row');
        cleanExpenseRowDate(row);
      });
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
requestAnimationFrame(queueEnhance);
