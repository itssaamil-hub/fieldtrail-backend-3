import { test, expect } from '@playwright/test';

const employees = Array.from({ length: 10 }, (_, i) => ({
  id: `employee-${i}`, full_name: ['Anand', 'Rohit', 'Sandeep', 'Jazeem'][i] || `Employee ${i}`,
  area: i ? 'Hazratganj' : 'Gomti Nagar', employee_code: `EMP-${i}`, phone: '9999999999',
  daily_target: 15, monthly_target: 100, status: i === 0 ? 'online' : 'offline', is_active: true,
  region: i < 5 ? 'Uttar Pradesh' : 'Karnataka',
  is_reporting_manager: i === 0,
  reporting_manager_id: i > 0 && i < 5 ? 'employee-0' : null,
  reporting_manager_name: i > 0 && i < 5 ? 'Anand' : null,
  last_battery_pct: 78, last_speed_mps: 0, last_seen_at: '2026-10-05T06:00:00Z', total_distance_m: 12400,
}));
const brief = (id) => ({ sessions: id === 'employee-2' ? [] : [{ startedAt: '2026-10-05T03:42:00Z' }], glance: { leadsAdded: 8 }, followUpHealth: { dueToday: 4 }, unfinished: { pendingTasks: 2 } });

async function boot(page, fail = false) {
  await page.route('http://127.0.0.1:9999/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let data = {};
    if (path === '/admin/salesmen') data = { salesmen: employees };
    else if (path === '/admin/employees/revenue') data = { rows: employees.map(s => ({ salesman_id: s.id, leads_created: url.searchParams.get('month') === 'all' ? 148 : 48, revenue: 45000, won: 3 })) };
    else if (/\/salesmen\/[^/]+\/brief$/.test(path)) data = brief(path.split('/')[3]);
    else if (path.includes('/history')) data = { route: [], leads: [] };
    else if (path.includes('/leads')) data = { leads: [], total: 0 };
    else if (path.includes('/messages')) data = { messages: [] };
    else if (path.includes('/tasks')) data = { tasks: [], notifications: [] };
    else if (path.includes('/quotations')) data = { quotes: [], alerts: [] };
    else if (path.includes('/location-policy')) data = { gpsLocation: true, locationMandatoryForNewLead: true, continuousGpsTracking: true, version: 1 };
    const failed = fail && (path.includes('/brief') || path.includes('/employees/revenue'));
    await route.fulfill({ status: failed ? 503 : 200, contentType: 'application/json', body: JSON.stringify(failed ? { error: 'Unavailable' } : data) });
  });
  await page.addInitScript(() => localStorage.setItem('fieldtrail:session', JSON.stringify({ id: 'test-admin', role: 'admin', name: 'Admin', token: 'test-token' })));
  await page.goto('/');
  await page.getByRole('button', { name: 'Employees', exact: true }).click();
  await expect(page.locator('.emp-card').first()).toBeVisible();
}

for (const width of [390, 1440]) {
  test(`Employees layout and existing actions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await boot(page);
    const panel = page.locator('.emp-page');
    const anand = panel.getByRole('article', { name: 'Anand employee card' });
    await expect(anand).toContainText('Working');
    await expect(anand.getByRole('progressbar', { name: 'Daily leads', exact: true })).toHaveAttribute('aria-valuetext', '8 of 15 leads');
    await expect(anand.getByRole('progressbar', { name: 'Monthly leads', exact: true })).toHaveAttribute('aria-valuetext', '48 of 100 leads');
    await expect(panel).not.toContainText(/Revenue|\bwon\b|\bOnline\b/);
    await expect(panel.locator('.emp-card')).toHaveCount(8);
    const cards = await panel.locator('.emp-card').evaluateAll(nodes => nodes.slice(0, 2).map(n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y }; }));
    expect(width > 700 ? cards[0].y === cards[1].y : cards[0].x === cards[1].x && cards[1].y > cards[0].y).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/employees-${width}.png`, fullPage: false });
    await panel.getByRole('button', { name: 'Working', exact: true }).click();
    await expect(panel.locator('.emp-card')).toHaveCount(1);
    await panel.getByRole('button', { name: 'Not started', exact: true }).click();
    await expect(panel.locator('.emp-card')).toHaveCount(1);
    await expect(panel.locator('.emp-card')).toContainText('Sandeep');
    await panel.getByRole('button', { name: 'All', exact: true }).click();
    await panel.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(panel.locator('.emp-card')).toHaveCount(2);
    await panel.getByRole('searchbox').fill('Gomti');
    await expect(panel.locator('.emp-card')).toHaveCount(1);
    await panel.getByLabel('Employee lead month').selectOption('all');
    await expect(anand).toContainText('148 leads');
    await expect(anand.getByRole('progressbar')).toHaveCount(1);
    await anand.getByRole('button', { name: 'Daily Brief', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Daily Brief — Anand' })).toBeVisible();
    await page.getByRole('button', { name: 'Close Daily Brief — Anand', exact: true }).last().click();
    await anand.getByRole('button', { name: 'View Route', exact: true }).click();
    await expect(page.getByText(/No location pings/i)).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('Employees unavailable data is not shown as zero or Not started', async ({ page }) => {
  await boot(page, true);
  const card = page.getByRole('article', { name: 'Rohit employee card' });
  await expect(card).toContainText('Activity unavailable');
  await expect(card.locator('.emp-status')).toHaveText('Unavailable');
  await expect(card.locator('.emp-metric strong')).toHaveText(['—', '—', '—']);
  await expect(card.getByRole('progressbar')).toHaveCount(0);
});

test('Dashboard keeps the existing employee layout', async ({ page }) => {
  await boot(page);
  await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
  await expect(page.locator('.engage-employee-panel-enhanced')).toBeVisible();
  await expect(page.locator('.emp-page')).toHaveCount(0);
});
