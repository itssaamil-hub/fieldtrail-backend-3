import { test, expect } from '@playwright/test';

const apiBase = 'http://127.0.0.1:9999';
const employee = {
  id: 'smoke-salesman', full_name: 'Smoke Salesman', phone: '9999999999', area: 'Test Area',
  employee_code: 'SMK-1', daily_target: 8, monthly_target: 200, status: 'offline', is_active: true,
  last_lat: null, last_lng: null, last_battery_pct: null, last_speed_mps: 0, last_seen_at: null, total_distance_m: 0,
};

function responseFor(pathname, method) {
  if (/\/admin\/salesmen\/[^/]+\/history$/.test(pathname)) return { route: [], leads: [] };
  if (/\/admin\/salesmen\/[^/]+\/brief$/.test(pathname)) return { sessions: [], glance: { leadsAdded: 0 }, followUpHealth: { dueToday: 0 }, unfinished: { pendingTasks: 0 } };
  if (pathname === '/admin/salesmen') return { salesmen: [employee] };
  if (pathname === '/admin/dashboard/summary') return { conversationLeads: 0 };
  if (pathname.startsWith('/admin/leads')) return { leads: [], total: 0 };
  if (pathname.startsWith('/admin/expenses')) return [];
  if (pathname === '/day-closing/reports') return { reports: [], hasMore: false };
  if (pathname.startsWith('/day-closing/permissions/')) return { require_closing: false, allow_skip: true, require_skip_reason: false, allow_multiple_starts: true, allow_lead_without_start_day: true };
  if (pathname === '/admin/reports/performance-targets') return { targets: [] };
  if (/\/admin\/employees\/[^/]+\/incentive-plan$/.test(pathname)) return { plan: null };
  if (/\/admin\/employees\/[^/]+\/location-policy$/.test(pathname)) return { gpsLocation: true, locationMandatoryForNewLead: true, continuousGpsTracking: true, version: 1 };
  if (pathname === '/tasks/notifications') return { notifications: [] };
  if (pathname === '/tasks' || pathname.startsWith('/tasks?')) return { tasks: [], hasMore: false };
  if (pathname.includes('/notifications')) return {};
  if (pathname === '/salesman/leads-summary') return {};
  if (pathname === '/salesman/leads') return { leads: [], total: 0 };
  if (pathname === '/salesman/tasks') return { tasks: [], hasMore: false };
  if (pathname === '/salesman/messages') return { messages: [] };
  if (pathname.includes('/attendance')) return {};
  if (pathname.includes('/settings')) return {};
  if (pathname === '/quotations/alerts') return { alerts: [] };
  if (pathname === '/quotations') return { quotes: [], hasMore: false };
  if (pathname === '/onboarding/customers') return { customers: [], hasMore: false };
  if (pathname === '/collections') return { accounts: [], summary: { collected: 0, pending: 0, overdue: 0 }, employees: [], hasMore: false };
  if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') return { ok: true };
  return {};
}

async function mockBackend(page) {
  await page.route(`${apiBase}/**`, async route => {
    const req = route.request();
    const url = new URL(req.url());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(responseFor(url.pathname, req.method())) });
  });
}

async function bootAs(page, session) {
  await mockBackend(page);
  await page.addInitScript(sessionValue => localStorage.setItem('fieldtrail:session', JSON.stringify(sessionValue)), session);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(750);
  await expect(page.getByText('Engage needs to reload')).toHaveCount(0);
}

async function noCrash(page) {
  await page.waitForTimeout(250);
  await expect(page.getByText('Engage needs to reload')).toHaveCount(0);
}

const adminSession = { id: 'smoke-admin', role: 'admin', name: 'Smoke Admin', fullName: 'Smoke Admin', token: 'smoke-token' };

test('admin Add Deal surface renders without crash', async ({ page }) => {
  await bootAs(page, adminSession);
  await page.getByRole('button', { name: 'Deals', exact: true }).click();
  const addDeal = page.getByRole('button', { name: /add deal/i }).first();
  await expect(addDeal).toBeVisible();
  await addDeal.click();
  await noCrash(page);
  await expect(page.locator('body')).toContainText(/Add Deal|Lead information/i);
});

test('employee View Route renders without crash', async ({ page }) => {
  await bootAs(page, adminSession);
  await page.getByRole('button', { name: 'Employees' }).click();
  await noCrash(page);
  await expect(page.getByText('Smoke Salesman', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: /view route/i }).click();
  await noCrash(page);
  await expect(page.locator('body')).toContainText(/No location pings|Route/i);
});

test('employee Settings renders without crash', async ({ page }) => {
  await bootAs(page, adminSession);
  await page.getByRole('button', { name: 'Employees' }).click();
  await noCrash(page);
  const employeeSettings = page.getByRole('button', { name: 'Settings' }).last();
  await employeeSettings.click();
  await noCrash(page);
  await expect(page.locator('body')).toContainText(/Employee Settings|Work Rules|Targets/i);
});

test('reports and Day Closing reports render without crash', async ({ page }) => {
  await bootAs(page, adminSession);
  await page.getByRole('button', { name: 'Reports' }).click();
  await noCrash(page);
  await expect(page.getByText('Day Closing reports')).toBeVisible();
  await page.getByText('Day Closing reports').click();
  await noCrash(page);
  await expect(page.locator('body')).toContainText(/Day Closing reports|No records for this date/i);
});

test('tasks surface renders without crash', async ({ page }) => {
  await bootAs(page, adminSession);
  await page.getByRole('button', { name: 'Tasks' }).click();
  await noCrash(page);
  await expect(page.locator('body')).toContainText(/Tasks/i);
});

test('app menu opens onboarding and quotations without crash', async ({ page }) => {
  await bootAs(page, adminSession);
  const menu = page.getByRole('button', { name: 'Menu' });
  await menu.click();
  await page.getByRole('button', { name: /Onboarding checklist/i }).click();
  await noCrash(page);
  await expect(page.locator('body')).toContainText(/Customer onboarding|No matching customers/i);
  await page.keyboard.press('Escape');

  await menu.click();
  await page.getByRole('button', { name: /^Quotations$/i }).click();
  await noCrash(page);
  await expect(page.locator('body')).toContainText(/Quotations|SALES WORKSPACE/i);
});

test('payments report renders without crash', async ({ page }) => {
  await bootAs(page, adminSession);
  await page.getByRole('button', { name: 'Reports' }).click();
  await noCrash(page);
  await page.getByRole('button', { name: 'Payments', exact: true }).click();
  await noCrash(page);
  await expect(page.locator('body')).toContainText(/Track collections|No matching accounts|Payments/i);
});

test('notification surface does not trigger crash boundary', async ({ page }) => {
  await bootAs(page, adminSession);
  const notificationButton = page.getByRole('button', { name: /notification|bell/i }).first();
  await expect(notificationButton).toBeVisible();
  await notificationButton.click();
  await noCrash(page);
  await expect(page.locator('body')).toContainText(/Notifications|Daily sales briefing/i);
});

test('salesman mobile navigation uses Contacts and dashboard Deal actions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await bootAs(page, { id: 'smoke-salesman', role: 'salesman', name: 'Smoke Salesman', fullName: 'Smoke Salesman', token: 'smoke-token' });
  await expect(page.getByRole('button', { name: 'Contacts' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Deal' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'My Deal' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Menu' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Notifications/i })).toBeVisible();
  await page.getByRole('button', { name: 'Contacts' }).click();
  await noCrash(page);
  await expect(page.locator('body')).toContainText(/Contacts|Your contacts/i);
  await page.getByRole('button', { name: 'Dashboard' }).click();
  await page.getByRole('button', { name: 'My Deal' }).click();
  await noCrash(page);
  await expect(page.locator('body')).toContainText(/My Leads|Leads/i);
});

test('salesman shell renders without crash', async ({ page }) => {
  await bootAs(page, { id: 'smoke-salesman', role: 'salesman', name: 'Smoke Salesman', fullName: 'Smoke Salesman', token: 'smoke-token' });
  await expect(page.locator('body')).toContainText(/Engage|Today|Leads|Start Day/i);
  await noCrash(page);
});
