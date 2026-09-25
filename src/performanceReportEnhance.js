const ROOT_CLASS = 'engage-performance-report';

function text(node) {
  return (node?.textContent || '').replace(/\s+/g, ' ').trim();
}

function findRoot() {
  const title = [...document.querySelectorAll('div')].find((el) => text(el) === 'Monthly performance & targets');
  if (!title) return null;
  let root = title.parentElement;
  while (root && root !== document.body) {
    const t = text(root);
    if (t.includes('Employee progress') && t.includes('Restaurant visits') && t.includes('Sales value')) break;
    root = root.parentElement;
  }
  return root && root !== document.body ? { root, title } : null;
}

function findControls(root) {
  const month = root.querySelector('input[type="month"]');
  const employee = [...root.querySelectorAll('select')].find((s) => [...s.options].some((o) => /All employees/i.test(o.textContent || '')));
  if (!month || !employee) return null;
  const holder = month.parentElement;
  return { month, employee, holder };
}

function findKpiCards(root) {
  const labels = new Set(['LEADS', 'RESTAURANT VISITS', 'DEMOS', 'WON', 'SALES VALUE']);
  const found = [];
  [...root.querySelectorAll('div')].forEach((el) => {
    const first = el.firstElementChild;
    if (!first) return;
    const label = text(first).toUpperCase();
    if (!labels.has(label)) return;
    if (found.some((x) => x.contains(el) || el.contains(x))) return;
    found.push(el);
  });
  return found.slice(0, 5);
}

function metricValue(card) {
  const parts = [...card.children].map(text).filter(Boolean);
  return parts[1] || '';
}

function ensureHero(root, titleNode, controls) {
  let hero = root.querySelector('.engage-performance-hero');
  if (!hero) {
    hero = document.createElement('div');
    hero.className = 'engage-performance-hero';
    hero.innerHTML = `
      <div class="engage-performance-hero-copy">
        <div class="engage-performance-kicker">EMPLOYEE PERFORMANCE</div>
        <h1>Monthly Performance</h1>
        <p>Track activity, conversion, targets and sales performance in one place.</p>
      </div>
      <div class="engage-performance-hero-actions"></div>`;
    root.insertBefore(hero, root.firstChild);
  }

  const originalHeader = titleNode.parentElement?.parentElement;
  if (originalHeader && originalHeader !== hero) originalHeader.classList.add('engage-performance-original-head');

  const actions = hero.querySelector('.engage-performance-hero-actions');
  if (controls?.holder && controls.holder.parentElement !== actions) {
    controls.holder.classList.add('engage-performance-filter-group');
    actions.appendChild(controls.holder);
  }
  if (!actions.querySelector('.engage-performance-refresh')) {
    const refresh = document.createElement('button');
    refresh.className = 'engage-performance-refresh';
    refresh.type = 'button';
    refresh.innerHTML = '↻ Refresh';
    refresh.addEventListener('click', () => window.location.reload());
    actions.appendChild(refresh);
  }
}

function enhanceKpis(root) {
  const cards = findKpiCards(root);
  if (!cards.length) return;
  const grid = cards[0].parentElement;
  if (grid) grid.classList.add('engage-performance-kpi-grid');
  const classes = ['leads', 'visits', 'demos', 'won', 'sales'];
  cards.forEach((card, index) => {
    card.classList.add('engage-performance-kpi', `is-${classes[index] || 'metric'}`);
    const children = [...card.children];
    if (children[0]) children[0].classList.add('engage-performance-kpi-label');
    if (children[1]) children[1].classList.add('engage-performance-kpi-value');
  });

  if (!root.querySelector('.engage-performance-funnel')) {
    const values = cards.map(metricValue);
    const leads = Number(String(values[0]).replace(/[^0-9.]/g, '')) || 0;
    const demos = Number(String(values[2]).replace(/[^0-9.]/g, '')) || 0;
    const won = Number(String(values[3]).replace(/[^0-9.]/g, '')) || 0;
    const demoPct = leads > 0 ? Math.round((demos / leads) * 100) : 0;
    const wonPct = demos > 0 ? Math.round((won / demos) * 100) : 0;
    const funnel = document.createElement('div');
    funnel.className = 'engage-performance-funnel';
    funnel.innerHTML = `
      <div><span>Performance funnel</span><strong>${values[0] || '0'} Leads</strong></div>
      <i>${demoPct}%</i><div><strong>${values[2] || '0'} Demos</strong></div>
      <i>${wonPct}%</i><div><strong>${values[3] || '0'} Won</strong></div>
      <i>→</i><div><strong>${values[4] || '₹0'} Sales</strong></div>`;
    grid?.insertAdjacentElement('afterend', funnel);
  }
}

function findEmployeeArea(root) {
  const label = [...root.querySelectorAll('div')].find((el) => text(el).toUpperCase() === 'EMPLOYEE PROGRESS');
  if (!label) return null;
  let grid = label.nextElementSibling;
  if (!grid || grid.children.length === 0) grid = label.parentElement?.querySelector(':scope > div:last-child');
  return { label, grid };
}

function parseCardActivity(card) {
  const t = text(card);
  const values = [...t.matchAll(/(?:Restaurant visits|New leads|Demos|Deals won)\s+(\d+)/gi)].map((m) => Number(m[1] || 0));
  const noActivity = values.length >= 4 && values.every((v) => v === 0);
  const pct = [...t.matchAll(/(\d{1,3})%/g)].map((m) => Number(m[1])).filter((v) => Number.isFinite(v));
  const hasTarget = /\/\s*₹?[\d.]+[KLCrM]?/i.test(t) || pct.length > 0;
  const onTarget = pct.some((v) => v >= 100);
  return { noActivity, hasTarget, onTarget };
}

function enhanceEmployeeCards(root) {
  const area = findEmployeeArea(root);
  if (!area?.grid) return;
  area.label.classList.add('engage-performance-section-label');
  area.grid.classList.add('engage-performance-employee-grid');

  const cards = [...area.grid.children];
  cards.forEach((card) => {
    if (!(card instanceof HTMLElement)) return;
    card.classList.add('engage-performance-employee-card');
    const state = parseCardActivity(card);
    if (state.noActivity) card.classList.add('is-no-activity');

    const first = card.firstElementChild;
    const name = first?.querySelector('div') || first;
    if (name) name.classList.add('engage-performance-employee-head');

    if (!card.querySelector('.engage-performance-target-pill')) {
      const pill = document.createElement('span');
      pill.className = 'engage-performance-target-pill';
      pill.textContent = state.noActivity ? 'No activity' : state.onTarget ? 'On target' : state.hasTarget ? 'Behind target' : 'No target';
      pill.dataset.state = state.noActivity ? 'idle' : state.onTarget ? 'good' : state.hasTarget ? 'behind' : 'none';
      card.insertBefore(pill, card.firstChild?.nextSibling || null);
    }

    [...card.querySelectorAll('div')].forEach((row) => {
      const t = text(row);
      if (/^(Restaurant visits|New leads|Demos|Deals won|Sales value)\b/i.test(t)) row.classList.add('engage-performance-metric-row');
      if (/Calculated incentive/i.test(t)) row.classList.add('engage-performance-incentive');
    });

    const percentTexts = [...card.querySelectorAll('div,span')].filter((el) => /^\d{1,3}%$/.test(text(el)));
    if (percentTexts.length && !card.querySelector('.engage-performance-glance')) {
      const glance = document.createElement('div');
      glance.className = 'engage-performance-glance';
      glance.textContent = `At a glance · ${percentTexts.map((el) => text(el)).join(' · ')}`;
      const incentive = card.querySelector('.engage-performance-incentive');
      if (incentive) incentive.insertAdjacentElement('beforebegin', glance);
      else card.appendChild(glance);
    }
  });

  if (!root.querySelector('.engage-performance-status-summary')) {
    const states = cards.map(parseCardActivity);
    const onTarget = states.filter((s) => s.onTarget && !s.noActivity).length;
    const needs = states.filter((s) => s.hasTarget && !s.onTarget && !s.noActivity).length;
    const idle = states.filter((s) => s.noActivity).length;
    const summary = document.createElement('div');
    summary.className = 'engage-performance-status-summary';
    summary.innerHTML = `<span><b>${onTarget}</b> On target</span><span><b>${needs}</b> Needs attention</span><span><b>${idle}</b> No activity</span>`;
    area.label.insertAdjacentElement('afterend', summary);
  }
}

function enhance() {
  const found = findRoot();
  if (!found) return;
  const { root, title } = found;
  root.classList.add(ROOT_CLASS);
  const controls = findControls(root);
  ensureHero(root, title, controls);
  enhanceKpis(root);
  enhanceEmployeeCards(root);
}

let queued = false;
function queue() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; enhance(); });
}

const observer = new MutationObserver(queue);
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
window.addEventListener('load', queue);
window.addEventListener('resize', queue);
requestAnimationFrame(queue);
