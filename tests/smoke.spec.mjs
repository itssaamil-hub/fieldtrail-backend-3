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
  if (pathname === '/salesman/settings') return { employeePermissions: { allowLeadWithoutStartDay: true }, locationSettings: { gpsLocation: false, locationMandatoryForNewLead: false, continuousGpsTracking: false }, leadSettings: {} };
  if (pathname === '/admin/settings') return {
    leadSettings: {
      requireBusinessName: true, requireSubLocation: true, requirePosName: true, requireContactName: true,
      requireContactNumber: true, requireStatus: true, requireComments: false, requireDealValue: false,
      requireFollowUpDate: false, duplicateProtectionEnabled: true, duplicateCheckPhone: true,
      duplicateCheckBusinessLocation: true, allowDuplicateOverride: false,
      automationRules: { inactiveLeadFollowUp: { enabled: false, inactivityDays: 5, stages: ["cold","conversation","hot","demo","negotiation","nurture"] } },
    },
    locationSettings: { gpsLocation: true, locationMandatoryForNewLead: true, continuousGpsTracking: true },
    messageSettings: { employeeRepliesEnabled: true },
  };
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
    if (url.pathname === '/admin/settings' && req.method() === 'PATCH') {
      const body = req.postDataJSON();
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        leadSettings: body.leadSettings,
        locationSettings: body.locationSettings,
        messageSettings: body.messageSettings,
      }) });
    }
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
  await page.getByRole('button', { name: 'Pipeline', exact: true }).click();
  const addDeal = page.getByRole('button', { name: /add lead/i }).first();
  await expect(addDeal).toBeVisible();
  await addDeal.click();
  await noCrash(page);
  await expect(page.locator('body')).toContainText(/Add Lead|Business Information/i);
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

test('reports and Day Closing report render without crash', async ({ page }) => {
  await bootAs(page, adminSession);
  await page.getByRole('button', { name: 'Reports' }).click();
  await noCrash(page);
  const dayClosingCard = page.getByText('Day Closing Report', { exact: true });
  await expect(dayClosingCard).toBeVisible();
  await dayClosingCard.click();
  await noCrash(page);
  await expect(page.locator('body')).toContainText(/Day Closing Report|No matching Day Closing records for this date/i);
});

test('tasks surface renders without crash', async ({ page }) => {
  await bootAs(page, adminSession);
  await page.getByRole('button', { name: 'Tasks' }).click();
  await noCrash(page);
  await expect(page.locator('body')).toContainText(/Tasks/i);
});

test('desktop app menu keeps non-sidebar actions and Quotations opens from sidebar', async ({ page }) => {
  await bootAs(page, adminSession);
  const menu = page.getByRole('button', { name: 'Menu' });
  await menu.click();
  let appMenu = page.getByRole('navigation', { name: 'App menu' });
  await expect(appMenu.getByRole('button', { name: /Onboarding checklist/i })).toBeVisible();
  await expect(appMenu.getByRole('button', { name: /Quotation approvals/i })).toBeVisible();
  await expect(appMenu.getByRole('button', { name: /^Payments$/i })).toHaveCount(0);
  await expect(appMenu.getByRole('button', { name: /^Quotations$/i })).toHaveCount(0);
  await expect(appMenu.getByRole('button', { name: /^Settings$/i })).toHaveCount(0);
  await appMenu.getByRole('button', { name: /Onboarding checklist/i }).click();
  await noCrash(page);
  await expect(page.locator('body')).toContainText(/Customer onboarding|No matching customers/i);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Open Quotations' }).click();
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


test('desktop Engage brand returns admin to Dashboard without changing sidebar navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootAs(page, adminSession);
  await page.getByRole('button', { name: 'Employees', exact: true }).click();
  await expect(page.locator('body')).toContainText('Employees');
  const homeLogo = page.getByRole('button', { name: 'Home', exact: true });
  await expect(homeLogo).toBeVisible();
  await homeLogo.click();
  await expect(page.getByText('Total Employees', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dashboard', exact: true })).toHaveAttribute('aria-current', 'page');
  await noCrash(page);
});

test('admin mobile Engage logo returns to Dashboard from another section', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await bootAs(page, adminSession);
  await page.getByRole('button', { name: 'Contacts', exact: true }).click();
  await expect(page.locator('body')).toContainText(/Contacts/i);
  const homeLogo = page.getByRole('button', { name: 'Home', exact: true });
  await expect(homeLogo).toBeVisible();
  await homeLogo.click();
  await expect(page.getByText('Total Employees', { exact: true })).toBeVisible();
  await noCrash(page);
});

test('salesman mobile Engage logo returns to employee Dashboard from Contacts', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await bootAs(page, { id: 'smoke-salesman', role: 'salesman', name: 'Smoke Salesman', fullName: 'Smoke Salesman', token: 'smoke-token' });
  await page.getByRole('button', { name: 'Contacts', exact: true }).click();
  await expect(page.locator('body')).toContainText(/Contacts|Your contacts/i);
  const homeLogo = page.getByRole('button', { name: 'Home', exact: true });
  await expect(homeLogo).toBeVisible();
  await homeLogo.click();
  await expect(page.getByRole('button', { name: 'Add Deal' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'My Deal' })).toBeVisible();
  await noCrash(page);
});


test('admin Add Lead uses one Renewal control for month or exact date', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootAs(page, adminSession);
  await page.getByRole('button', { name: 'Pipeline', exact: true }).click();
  await page.getByRole('button', { name: /add lead/i }).first().click();

  const dialog = page.getByRole('dialog', { name: 'Add Lead' });
  const renewal = dialog.locator('[data-renewal-control="true"]');
  await expect(renewal).toHaveCount(1);
  await expect(renewal.getByRole('combobox', { name: 'Renewal month' })).toBeVisible();
  await renewal.getByRole('combobox', { name: 'Renewal month' }).selectOption({ label: 'November' });

  await renewal.getByRole('button', { name: 'Exact date' }).click();
  await expect(renewal.getByRole('combobox', { name: 'Renewal month' })).toHaveCount(0);
  const date = renewal.getByLabel('Renewal date');
  await expect(date).toBeVisible();
  await date.fill('2026-11-15');
  await expect(date).toHaveValue('2026-11-15');
  await noCrash(page);
});

test('salesman Add Deal uses the same single Renewal control', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await bootAs(page, { id: 'smoke-salesman', role: 'salesman', name: 'Smoke Salesman', fullName: 'Smoke Salesman', token: 'smoke-token' });
  await page.getByRole('button', { name: 'Add Deal' }).click();

  const renewal = page.locator('[data-renewal-control="true"]');
  await expect(renewal).toHaveCount(1);
  await expect(renewal.getByRole('combobox', { name: 'Renewal month' })).toBeVisible();
  await renewal.getByRole('button', { name: 'Exact date' }).click();
  await expect(renewal.getByLabel('Renewal date')).toBeVisible();
  await expect(renewal.getByRole('combobox', { name: 'Renewal month' })).toHaveCount(0);
  await noCrash(page);
});


test('CRM Settings configures inactive lead follow-up automation without changing other settings', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootAs(page, adminSession);

  let savedLeadSettings = null;
  page.on('request', req => {
    if (new URL(req.url()).pathname === '/admin/settings' && req.method() === 'PATCH') {
      savedLeadSettings = req.postDataJSON()?.leadSettings || null;
    }
  });

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'CRM Settings', exact: true }).click();
  const rules = page.locator('[data-automation-rules="true"]');
  await expect(rules).toBeVisible();
  await expect(rules).toContainText('Automation Rules');
  await expect(rules).toContainText('Inactive lead follow-up');
  await expect(rules).toContainText('Show a small Inactive · Xd badge on matching leads.');
  await expect(rules).not.toContainText('create a linked follow-up task');

  const toggle = rules.getByRole('switch').first();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => savedLeadSettings?.automationRules?.inactiveLeadFollowUp?.enabled).toBe(true);

  const days = rules.getByLabel('Inactive lead days');
  await days.fill('7');
  await days.blur();
  await expect.poll(() => savedLeadSettings?.automationRules?.inactiveLeadFollowUp?.inactivityDays).toBe(7);

  const stages = rules.locator('[data-automation-stages="true"]');
  for (const label of ['Cold','Conversation','Hot','Demo','Negotiation','Won','Lost','Nurture']) {
    await expect(stages.getByLabel(`Automation stage ${label}`)).toBeVisible();
  }
  await expect(stages.getByLabel('Automation stage Won')).not.toBeChecked();
  await stages.getByLabel('Automation stage Won').click();
  await expect.poll(() => savedLeadSettings?.automationRules?.inactiveLeadFollowUp?.stages?.includes('won')).toBe(true);
  await expect(stages.getByLabel('Automation stage Won')).toBeChecked();

  await stages.getByLabel('Automation stage Hot').click();
  await expect.poll(() => savedLeadSettings?.automationRules?.inactiveLeadFollowUp?.stages?.includes('hot')).toBe(false);
  await expect(stages.getByLabel('Automation stage Hot')).not.toBeChecked();
  await expect(savedLeadSettings.requireBusinessName).toBe(true);
  await noCrash(page);
});


test('admin mobile Deals shows the small inactivity capsule from backend state', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await bootAs(page, adminSession);

  const inactiveLead = {
    id: '11111111-1111-4111-8111-111111111111',
    client_uuid: '22222222-2222-4222-8222-222222222222',
    salesman_id: employee.id,
    salesman_name: employee.full_name,
    business_name: 'Cafe 91',
    sub_location: 'Gomti Nagar',
    contact_name: 'Aamil',
    phone: '9999999998',
    status: 'hot',
    deal_value: 25000,
    created_at: '2026-10-01T10:00:00.000Z',
    updated_at: '2026-10-06T10:00:00.000Z',
    inactive_days: 6,
    inactive_since: '2026-10-06T10:00:00.000Z',
  };

  await page.route(`${apiBase}/admin/leads**`, async route => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ leads: [inactiveLead], total: 1, page: 1, totalPages: 1 }) });
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(750);

  await page.getByRole('button', { name: 'Deals', exact: true }).click();
  const badge = page.locator('[data-inactive-badge="true"]');
  await expect(badge).toHaveCount(1);
  await expect(badge).toHaveText('Inactive · 6d');
  const cafeCard = page.getByRole('button', { name: /Cafe 91/ });
  await expect(cafeCard.getByText('Cafe 91', { exact: true })).toBeVisible();
  await expect(cafeCard.getByText('Hot', { exact: true })).toBeVisible();
  await noCrash(page);
});


test('desktop admin Settings and CRM Settings are full-page and normal sidebar navigation exits safely', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootAs(page, adminSession);

  const settingsButton = page.getByRole('button', { name: 'Settings', exact: true }).first();
  await settingsButton.click();

  const settingsPage = page.locator('[data-desktop-settings-page="true"]');
  await expect(settingsPage).toHaveCount(1);
  await expect(settingsPage.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(settingsButton).toHaveAttribute('aria-pressed', 'true');
  const settingsBox = await settingsPage.boundingBox();
  expect(settingsBox?.width || 0).toBeGreaterThan(800);

  await settingsPage.getByRole('button', { name: 'CRM Settings', exact: true }).click();
  await expect(page.locator('[data-desktop-settings-page="true"]')).toHaveCount(1);
  const crmPage = page.locator('[data-desktop-settings-page="true"]');
  await expect(crmPage.getByRole('heading', { name: 'CRM Settings', exact: true })).toBeVisible();
  await expect(crmPage.getByRole('button', { name: 'Back to Settings' })).toBeVisible();
  await expect(crmPage.locator('[data-automation-rules="true"]')).toBeVisible();
  await expect(settingsButton).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
  await expect(page.locator('[data-desktop-settings-page="true"]')).toHaveCount(0);
  await expect(settingsButton).toHaveAttribute('aria-pressed', 'false');
  await noCrash(page);
});

test('mobile admin Settings keeps the existing overlay behavior', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await bootAs(page, adminSession);

  await page.getByRole('button', { name: 'More', exact: true }).click();
  const appMenu = page.getByRole('navigation', { name: 'App menu' });
  await appMenu.getByRole('button', { name: 'Settings', exact: true }).click();

  await expect(page.locator('[data-desktop-settings-page="true"]')).toHaveCount(0);
  await expect(page.locator('body')).toContainText('Settings');
  await noCrash(page);
});


test('Exception Centre Rules adds only stale Cold and Conversation rows without changing overview cards', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootAs(page, adminSession);

  await page.getByRole('button', { name: 'Exception Centre', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Exception Centre', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Rules', exact: true }).click();
  await expect(page.getByText('Stale Cold leads', { exact: true })).toBeVisible();
  await expect(page.getByText('Stale Conversation leads', { exact: true })).toBeVisible();
  await expect(page.getByText('Stale Hot leads', { exact: true })).toBeVisible();
  await expect(page.getByText('Stuck Negotiations', { exact: true })).toBeVisible();

  await expect(page.getByText('Stale hot leads', { exact: true })).toBeVisible();
  await expect(page.getByText('Stuck negotiations', { exact: true })).toBeVisible();
  await expect(page.getByText('Stale cold leads', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Stale conversation leads', { exact: true })).toHaveCount(0);
  await noCrash(page);
});
