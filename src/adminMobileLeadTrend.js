import { api, getSession } from './api.js';

const CARD_ID = 'engage-admin-mobile-lead-trend';
const UTILITY_ROW_ID = 'engage-admin-mobile-dashboard-utility';
const FILTER_PLACEHOLDER_ID = 'engage-admin-mobile-team-filter-placeholder';
const PHONE_MAX = 900;
const DAY_MS = 86400000;
let loading = false;
let cache = null;
let cacheAt = 0;

function istParts(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = type => parts.find(part => part.type === type)?.value || '';
  return { year: get('year'), month: get('month'), day: get('day') };
}

function istKey(date) {
  const p = istParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

function dayLabel(date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function buildDays(offsetStart, count) {
  const now = Date.now();
  return Array.from({ length: count }, (_, index) => {
    const daysAgo = offsetStart + (count - 1 - index);
    const date = new Date(now - daysAgo * DAY_MS);
    return { key: istKey(date), label: dayLabel(date), value: 0 };
  });
}

function createdAtOf(lead) {
  return lead?.created_at || lead?.createdAt || null;
}

function aggregate(leads) {
  const current = buildDays(0, 7);
  const previous = buildDays(7, 7);
  const currentMap = new Map(current.map(day => [day.key, day]));
  const previousMap = new Map(previous.map(day => [day.key, day]));

  for (const lead of leads) {
    const raw = createdAtOf(lead);
    if (!raw) continue;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) continue;
    const key = istKey(date);
    const bucket = currentMap.get(key) || previousMap.get(key);
    if (bucket) bucket.value += 1;
  }

  return {
    current,
    currentTotal: current.reduce((sum, day) => sum + day.value, 0),
    previousTotal: previous.reduce((sum, day) => sum + day.value, 0),
  };
}

function niceMax(value) {
  if (value <= 4) return 4;
  if (value <= 10) return 10;
  if (value <= 20) return 20;
  return Math.ceil(value / 10) * 10;
}

function svgMarkup(days) {
  const width = 360;
  const height = 122;
  const left = 28;
  const right = 10;
  const top = 8;
  const bottom = 28;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const maxValue = niceMax(Math.max(1, ...days.map(day => day.value)));
  const x = index => left + (plotW * index) / Math.max(1, days.length - 1);
  const y = value => top + plotH - (value / maxValue) * plotH;
  const points = days.map((day, index) => `${x(index)},${y(day.value)}`).join(' ');
  const area = `${left},${top + plotH} ${points} ${left + plotW},${top + plotH}`;
  const ticks = [0, maxValue / 2, maxValue];

  return `
    <svg class="engage-mobile-lead-trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Daily leads created in the last seven days">
      <defs>
        <linearGradient id="engageLeadTrendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#15916f" stop-opacity="0.20" />
          <stop offset="100%" stop-color="#15916f" stop-opacity="0.02" />
        </linearGradient>
      </defs>
      ${ticks.map(value => {
        const ty = y(value);
        return `<line x1="${left}" x2="${left + plotW}" y1="${ty}" y2="${ty}" class="engage-mobile-lead-trend-grid" />
          <text x="2" y="${ty + 4}" class="engage-mobile-lead-trend-y">${Math.round(value)}</text>`;
      }).join('')}
      <polygon points="${area}" fill="url(#engageLeadTrendFill)" />
      <polyline points="${points}" class="engage-mobile-lead-trend-line" />
      ${days.map((day, index) => `<circle cx="${x(index)}" cy="${y(day.value)}" r="3.5" class="engage-mobile-lead-trend-dot"><title>${day.label}: ${day.value} lead${day.value === 1 ? '' : 's'}</title></circle>`).join('')}
      ${days.map((day, index) => `<text x="${x(index)}" y="${height - 7}" text-anchor="middle" class="engage-mobile-lead-trend-x">${day.label}</text>`).join('')}
    </svg>`;
}

function trendBadge(current, previous) {
  if (previous <= 0) return current > 0 ? '<span class="engage-mobile-lead-trend-badge">New activity</span>' : '';
  const pct = Math.round(((current - previous) / previous) * 100);
  const direction = pct > 0 ? '↑' : pct < 0 ? '↓' : '→';
  const tone = pct < 0 ? ' is-down' : pct === 0 ? ' is-flat' : '';
  return `<span class="engage-mobile-lead-trend-badge${tone}">${direction} ${Math.abs(pct)}%</span>`;
}

function render(card, data) {
  card.innerHTML = `
    <div class="engage-mobile-lead-trend-head">
      <div>
        <div class="engage-mobile-lead-trend-title">Daily Leads Created</div>
        <div class="engage-mobile-lead-trend-sub">Last 7 days · ${data.currentTotal} lead${data.currentTotal === 1 ? '' : 's'}</div>
      </div>
      ${trendBadge(data.currentTotal, data.previousTotal)}
    </div>
    ${svgMarkup(data.current)}
  `;
}

async function load(card) {
  if (loading) return;
  if (cache && Date.now() - cacheAt < 60000) {
    render(card, cache);
    return;
  }
  loading = true;
  card.classList.add('is-loading');
  try {
    const result = await api.adminLeads();
    cache = aggregate(result?.leads || []);
    cacheAt = Date.now();
    render(card, cache);
  } catch {
    card.remove();
  } finally {
    loading = false;
    card.classList.remove('is-loading');
  }
}

function findDashboardGrid() {
  const cards = [...document.querySelectorAll('.engage-dashboard-stat')];
  if (cards.length < 5) return null;
  const parent = cards[0]?.parentElement;
  if (!parent) return null;
  const sameParent = cards.filter(card => card.parentElement === parent);
  return sameParent.length >= 5 ? parent : null;
}

function greetingFor(session) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(new Date()));
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const fullName = session?.fullName || session?.full_name || session?.name || 'Admin';
  const firstName = String(fullName).trim().split(/\s+/)[0] || 'Admin';
  return `${greeting}, ${firstName} 👋`;
}

function restoreTeamFilter() {
  const row = document.getElementById(UTILITY_ROW_ID);
  const select = row?.querySelector('select[aria-label="Dashboard employee"]');
  const placeholder = document.getElementById(FILTER_PLACEHOLDER_ID);
  if (select && placeholder?.parentElement) placeholder.insertAdjacentElement('afterend', select);
  row?.remove();
  placeholder?.remove();
}

function syncUtilityRow(grid, session) {
  let row = document.getElementById(UTILITY_ROW_ID);
  if (!row) {
    row = document.createElement('div');
    row.id = UTILITY_ROW_ID;
    row.className = 'engage-admin-mobile-dashboard-utility';
    row.innerHTML = '<div class="engage-admin-mobile-greeting"></div><div class="engage-admin-mobile-team-slot"></div>';
  }

  const greeting = row.querySelector('.engage-admin-mobile-greeting');
  if (greeting) greeting.textContent = greetingFor(session);

  const select = document.querySelector('select[aria-label="Dashboard employee"]');
  const slot = row.querySelector('.engage-admin-mobile-team-slot');
  if (select && slot && select.parentElement !== slot) {
    let placeholder = document.getElementById(FILTER_PLACEHOLDER_ID);
    if (!placeholder) {
      placeholder = document.createElement('span');
      placeholder.id = FILTER_PLACEHOLDER_ID;
      placeholder.hidden = true;
      select.insertAdjacentElement('beforebegin', placeholder);
    }
    slot.appendChild(select);
  }

  if (row.nextElementSibling !== grid) grid.insertAdjacentElement('beforebegin', row);
  return row;
}

function sync() {
  const session = getSession();
  const existing = document.getElementById(CARD_ID);
  const eligible = session?.role === 'admin' && window.innerWidth <= PHONE_MAX;
  if (!eligible) {
    existing?.remove();
    restoreTeamFilter();
    return;
  }

  const grid = findDashboardGrid();
  if (!grid || grid.offsetParent === null) {
    existing?.remove();
    restoreTeamFilter();
    return;
  }

  syncUtilityRow(grid, session);

  let card = existing;
  if (!card) {
    card = document.createElement('section');
    card.id = CARD_ID;
    card.className = 'engage-mobile-lead-trend is-loading';
    card.innerHTML = '<div class="engage-mobile-lead-trend-skeleton"></div>';
  }

  if (card.previousElementSibling !== grid) grid.insertAdjacentElement('afterend', card);
  load(card);
}

const observer = new MutationObserver(() => requestAnimationFrame(sync));
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('resize', sync);
window.addEventListener('focus', sync);
window.addEventListener('load', sync);
requestAnimationFrame(sync);
