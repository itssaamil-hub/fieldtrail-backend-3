import { test, expect } from '@playwright/test';

const apiBase = 'http://127.0.0.1:9999';

function responseFor(pathname, method) {
  if (pathname.includes('/admin/salesmen')) return [];
  if (pathname.includes('/admin/leads-summary')) return {};
  if (pathname.includes('/admin/leads')) return [];
  if (pathname.includes('/admin/expenses')) return [];
  if (pathname.includes('/admin/tasks')) return [];
  if (pathname.includes('/notifications')) return [];
  if (pathname.includes('/salesman/leads-summary')) return {};
  if (pathname.includes('/salesman/leads')) return [];
  if (pathname.includes('/salesman/tasks')) return [];
  if (pathname.includes('/salesman/messages')) return [];
  if (pathname.includes('/attendance')) return {};
  if (pathname.includes('/settings')) return {};
  if (pathname.includes('/quotations')) return [];
  if (pathname.includes('/collections')) return [];
  if (pathname.includes('/onboarding')) return [];
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

test('admin shell and major navigation render without crash', async ({ page }) => {
  await bootAs(page, { id: 'smoke-admin', role: 'admin', name: 'Smoke Admin', token: 'smoke-token' });
  await expect(page.locator('body')).toContainText(/Engage|Dashboard|Employees/i);
  const reports = page.getByText('Reports', { exact: true }).first();
  if (await reports.count()) {
    await reports.click();
    await page.waitForTimeout(250);
    await expect(page.getByText('Engage needs to reload')).toHaveCount(0);
    await expect(page.locator('body')).toContainText(/Reports|Day Closing/i);
  }
  const employees = page.getByText('Employees', { exact: true }).first();
  if (await employees.count()) {
    await employees.click();
    await page.waitForTimeout(250);
    await expect(page.getByText('Engage needs to reload')).toHaveCount(0);
  }
});

test('salesman shell renders without crash', async ({ page }) => {
  await bootAs(page, { id: 'smoke-salesman', role: 'salesman', name: 'Smoke Salesman', token: 'smoke-token' });
  await expect(page.locator('body')).toContainText(/Engage|Today|Leads|Start Day/i);
  await expect(page.getByText('Engage needs to reload')).toHaveCount(0);
});

test('settings and notification surfaces do not trigger crash boundary', async ({ page }) => {
  await bootAs(page, { id: 'smoke-admin', role: 'admin', name: 'Smoke Admin', token: 'smoke-token' });
  const settingsButton = page.getByRole('button', { name: /settings/i }).first();
  if (await settingsButton.count()) {
    await settingsButton.click();
    await page.waitForTimeout(250);
    await expect(page.getByText('Engage needs to reload')).toHaveCount(0);
  }
  await page.keyboard.press('Escape').catch(() => {});
  const notificationButton = page.getByRole('button', { name: /notification|bell/i }).first();
  if (await notificationButton.count()) {
    await notificationButton.click();
    await page.waitForTimeout(250);
    await expect(page.getByText('Engage needs to reload')).toHaveCount(0);
  }
});
