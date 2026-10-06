import { test, expect } from '@playwright/test';

const employees = Array.from({ length: 10 }, (_, i) => ({
  id: `employee-${i}`, full_name: ['Anand', 'Rohit', 'Sandeep', 'Jazeem'][i] || `Employee ${i}`,
  area: i ? 'Hazratganj' : 'Gomti Nagar', employee_code: `EMP-${i}`, phone: '9999999999',
  daily_target: 15, monthly_target: 100, status: i === 0 ? 'online' : 'offline', is_active: true,
  state_ut: 'Uttar Pradesh', city: i === 0 ? 'Lucknow' : 'Kanpur',
  last_battery_pct: 78, last_speed_mps: 0, last_seen_at: i === 3 ? null : '2026-10-05T06:00:00Z', total_distance_m: 12400,
}));
const brief = (id) => ({ sessions: id === 'employee-2' ? [] : [id === 'employee-3' ? { startedAt: '2026-10-05T03:42:00Z' } : { startedAt: '2026-10-05T03:42:00Z', lateMinutes: id === 'employee-0' ? 22 : 0 }], glance: { leadsAdded: 8 }, followUpHealth: { dueToday: 4 }, unfinished: { pendingTasks: 2, dueTodayTasks: id === 'employee-0' ? 2 : 1, overdueTasks: id === 'employee-0' ? 1 : 0 }, closing: id === 'employee-0' ? [] : [{ status: 'submitted' }] });

async function boot(page, fail = false) {
  await page.route('http://127.0.0.1:9999/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let data = {};
    if (path === '/admin/salesmen') data = { salesmen: employees };
    else if (path === '/attendance-v2/report') data = {
      employees: employees.map((s, i) => ({
        userId: s.id,
        details: [{
          day: '2026-10-05',
          state: i === 2 ? 'leave' : i === 1 ? 'Present' : i === 0 ? 'Day Open' : 'Not Started',
          hasOpen: i === 0,
          sessions: i === 2 || i >= 3 ? [] : [{ id: `session-${i}` }],
          exception: i === 2 ? { kind: 'leave', label: 'Approved leave' } : null,
          closing: i === 0 ? { required: true, completed: false, pending: true } : i === 1 ? { required: true, completed: true, pending: false } : { required: false, completed: false, pending: false },
          anomalies: i === 0 ? [{ type: 'gps_missing', label: 'GPS missing' }] : [],
        }],
      })),
    };
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
    await expect(anand).toContainText('22 min late');
    await expect(anand).toContainText('Last seen');
    await expect(anand.getByRole('progressbar', { name: 'Daily leads', exact: true })).toHaveAttribute('aria-valuetext', '8 of 15 leads');
    await expect(anand.getByRole('progressbar', { name: 'Monthly leads', exact: true })).toHaveAttribute('aria-valuetext', '48 of 100 leads');
    await expect(panel).not.toContainText(/Revenue|\bwon\b|\bOnline\b/);
    await expect(panel.locator('.emp-card')).toHaveCount(8);
    await panel.getByLabel('Employee city filter').fill('Lucknow');
    await expect(panel.locator('.emp-card')).toHaveCount(1);
    await expect(panel.locator('.emp-card')).toContainText('Anand');
    await panel.getByLabel('Employee city filter').fill('');
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

test('Employees use authoritative lateMinutes and real last_seen_at without fabricated fallbacks', async ({ page }) => {
  await boot(page);
  const anand = page.getByRole('article', { name: 'Anand employee card' });
  const rohit = page.getByRole('article', { name: 'Rohit employee card' });
  const jazeem = page.getByRole('article', { name: 'Jazeem employee card' });

  await expect(anand.locator('.emp-start')).toContainText('22 min late');
  await expect(rohit.locator('.emp-start')).toContainText('On time');

  await expect(jazeem.locator('.emp-start')).toContainText('Started');
  await expect(jazeem.locator('.emp-start')).not.toContainText('min late');
  await expect(jazeem.locator('.emp-start')).not.toContainText('On time');

  await expect(anand.locator('.emp-telemetry')).toContainText(/Last seen (Just now|\d+ min ago|\d+ hr ago|\d+ days? ago)/);
  await expect(jazeem.locator('.emp-telemetry')).toContainText('Last seen Unavailable');
  await expect(jazeem.locator('.emp-telemetry')).not.toContainText(/Last seen (Just now|\d+ min ago|\d+ hr ago|\d+ days? ago)/);
});

test('Employees unavailable data is not shown as zero or Not started', async ({ page }) => {
  await boot(page, true);
  const card = page.getByRole('article', { name: 'Rohit employee card' });
  await expect(card).toContainText('Activity unavailable');
  await expect(card.locator('.emp-status')).toHaveText('Unavailable');
  await expect(card.locator('.emp-metric strong')).toHaveText(['—', '—', '—']);
  await expect(card.getByRole('progressbar')).toHaveCount(0);
});

test('Dashboard keeps the map full width and omits employee panels', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await boot(page);
  await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
  await expect(page.locator('.engage-employee-panel-enhanced')).toHaveCount(0);
  await expect(page.locator('.emp-page')).toHaveCount(0);
  const mapCard = page.locator('.ft-card').filter({ hasText: 'Live Employees & Lead Map' }).first();
  await expect(mapCard).toBeVisible();
  const width = await mapCard.evaluate((node) => node.getBoundingClientRect().width);
  expect(width).toBeGreaterThan(900);
});


test('Mobile Total Employees KPI opens only the Employees Today operational view', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await boot(page);
  await page.getByRole('button', { name: 'Dashboard', exact: true }).click();

  const totalEmployees = page.locator('.engage-dashboard-stat').filter({ hasText: 'Total Employees' }).first();
  await expect(totalEmployees).toBeVisible();
  await expect(totalEmployees).toContainText('3');
  await expect(totalEmployees).toContainText('1 active now');

  await totalEmployees.click();
  const sheet = page.getByRole('dialog', { name: 'Employees Today' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('heading', { name: 'Employees — Today' })).toBeVisible();
  await expect(sheet).toContainText('Total 10 · 1 active now');

  const anand = sheet.getByRole('article', { name: 'Anand today status' });
  await expect(anand).toContainText('Working');
  await expect(anand).toContainText('22 min late');
  await expect(anand).toContainText('Last seen');
  await expect(anand).toContainText('Gomti Nagar');
  await expect(anand).toContainText('8');
  await expect(anand).toContainText('4');
  await expect(anand).toContainText('2 due · 1 overdue');
  await expect(anand).toContainText('Pending');
  await expect(anand).toContainText('Missing GPS');

  await sheet.getByRole('tab', { name: 'On Leave (1)' }).click();
  await expect(sheet.getByRole('article', { name: 'Sandeep today status' })).toContainText('On Leave');
  await expect(sheet.getByRole('article', { name: 'Anand today status' })).toHaveCount(0);

  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(sheet).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Desktop Total Employees KPI does not open the mobile Employees Today view', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await boot(page);
  await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
  const totalEmployees = page.locator('.engage-dashboard-stat').filter({ hasText: 'Total Employees' }).first();
  await totalEmployees.click();
  await expect(page.getByRole('dialog', { name: 'Employees Today' })).toHaveCount(0);
});
