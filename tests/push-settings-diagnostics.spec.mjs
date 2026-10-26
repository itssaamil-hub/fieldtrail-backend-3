import { test, expect } from '@playwright/test';

test('Admin push settings provides role-scoped toggles and a working signed-in test button', async ({ page }) => {
  let testRequests = 0;
  await page.route('http://127.0.0.1:9999/**', async route => {
    const url = new URL(route.request().url());
    let value = {};
    if (url.pathname === '/notifications/preferences') {
      value = { preferences: {
        hotLead: true, statusConversation: true, statusDemo: true,
        statusNegotiation: true, dealWon: false, targetMilestone: true,
        dayStartedEnded: true, dayClosingMissing: true,
        dayActivitySummary: true, dayStartDigest: true,
      }};
    } else if (url.pathname === '/notifications/debug') {
      value = { serverConfigured: true, subscriptionCount: 1, subscriptions: [] };
    } else if (url.pathname === '/notifications/test') {
      testRequests += 1;
      value = { ok: true, sent: 1, failed: 0, subscriptionCount: 1, errors: [] };
    } else if (url.pathname === '/admin/settings') {
      value = { leadSettings: {}, locationSettings: {}, messageSettings: {} };
    } else if (url.pathname.startsWith('/admin/leads')) {
      value = { leads: [], total: 0 };
    } else if (url.pathname === '/admin/salesmen') {
      value = { salesmen: [] };
    } else if (url.pathname === '/tasks/notifications') {
      value = { notifications: [] };
    } else if (url.pathname === '/notifications/unread') {
      value = { count: 0 };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value) });
  });

  await page.addInitScript(() => {
    localStorage.setItem('fieldtrail:session', JSON.stringify({
      id: 'admin-ui-test', token: 'test-token', role: 'admin',
      name: 'Test Admin', fullName: 'Test Admin',
    }));
    const fakeSubscription = { endpoint: 'https://push.test/user',
      toJSON: () => ({ endpoint: 'https://push.test/user', keys: { p256dh: 'test', auth: 'test' } }),
    };
    const reg = { pushManager: { getSubscription: async () => fakeSubscription } };
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: {
      getRegistrations: async () => [], register: async () => reg,
      addEventListener: () => {}, removeEventListener: () => {},
    }});
    Object.defineProperty(window, 'PushManager', { configurable: true, value: function PushManager() {} });
    Object.defineProperty(window, 'Notification', { configurable: true, value: {
      permission: 'granted', requestPermission: async () => 'granted',
    }});
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
  await page.locator('[data-open-push-settings="true"]').click();
  await expect(page.locator('[data-push-settings-page="true"]')).toBeVisible();

  await expect(page.getByRole('checkbox', { name: 'Deals won' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Follow-ups due' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Test & Verify' }).click();
  await expect(page.getByText('Configured', { exact: true })).toBeVisible();
  await expect(page.locator('[data-push-test-send="true"]')).toBeEnabled();
  await expect(testRequests).toBe(0);
  await page.locator('[data-push-test-send="true"]').click();
  await expect(page.getByText('1 accepted · 0 failed.', { exact: false })).toBeVisible();
  expect(testRequests).toBe(1);
  await expect(page.getByText('0 / 5 user-confirmed')).toBeVisible();
  await page.getByLabel('Receive test notification').check();
  await expect(page.getByText('1 / 5 user-confirmed')).toBeVisible();
  await page.getByRole('tab', { name: 'Preferences' }).click();
  await expect(page.getByRole('checkbox', { name: 'Deals won' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to Settings' }).click();
  await expect(page.locator('[data-open-push-settings="true"]')).toBeVisible();
  expect(testRequests).toBe(1);
});

test('Admin Push Notifications page fits narrow phones with independently scrollable settings and diagnostics', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.route('http://127.0.0.1:9999/**', async route => {
    const url = new URL(route.request().url());
    let result = {};
    if (url.pathname === '/notifications/preferences') {
      result = { preferences: { hotLead: true, dealWon: true, statusConversation: true, statusDemo: true, statusNegotiation: true } };
    } else if (url.pathname === '/notifications/debug') {
      result = { serverConfigured: true, subscriptionCount: 1 };
    } else if (url.pathname === '/notifications/unread') {
      result = { count: 0 };
    } else if (url.pathname === '/admin/salesmen') {
      result = { salesmen: [] };
    } else if (url.pathname.startsWith('/admin/leads')) {
      result = { leads: [], total: 0 };
    } else if (url.pathname === '/tasks/notifications') {
      result = { notifications: [] };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
  });
  await page.addInitScript(() => {
    localStorage.setItem('fieldtrail:session', JSON.stringify({
      id: 'admin-responsive-test', token: 'test-token', role: 'admin',
      name: 'Responsive Admin', fullName: 'Responsive Admin',
    }));
    const subscription = {
      toJSON: () => ({ endpoint: 'https://push.test/user', keys: { p256dh: 'x', auth: 'y' } }),
    };
    const reg = { pushManager: { getSubscription: async () => subscription } };
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: {
      getRegistrations: async () => [], register: async () => reg,
      addEventListener: () => {}, removeEventListener: () => {},
    }});
    Object.defineProperty(window, 'PushManager', { configurable: true, value: function PushManager() {} });
    Object.defineProperty(window, 'Notification', { configurable: true, value: { permission: 'granted', requestPermission: async () => 'granted' } });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'More', exact: true }).click();
  const appMenu = page.getByRole('navigation', { name: 'App menu' });
  await appMenu.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.locator('[data-open-push-settings="true"]').click();
  await expect(page.locator('[data-full-push-page="true"]')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Hot leads' })).toBeVisible();

  for (const width of [320, 375, 430, 768]) {
    await page.setViewportSize({ width, height: 640 });
    await expect(page.locator('[data-full-push-page="true"]')).toBeVisible();
    const state = await page.evaluate(() => {
      const fullPage = document.querySelector('[data-full-push-page="true"]');
      const panel = document.querySelector('[data-push-settings-page="true"]');
      const bounds = fullPage.getBoundingClientRect();
      const panelBounds = panel.getBoundingClientRect();
      return {
        pageWidth: Math.round(bounds.width), panelRight: panelBounds.right,
        pageScrollHeight: fullPage.scrollHeight, pageClientHeight: fullPage.clientHeight,
        viewportWidth: window.innerWidth, docScrollWidth: document.documentElement.scrollWidth,
      };
    });
    expect(state.pageWidth).toBe(width);
    expect(state.panelRight).toBeLessThanOrEqual(width + 1);
    expect(state.docScrollWidth).toBeLessThanOrEqual(width + 1);
    expect(state.pageScrollHeight).toBeGreaterThan(state.pageClientHeight);
  }
  await page.setViewportSize({ width: 320, height: 640 });
  await page.getByRole('tab', { name: 'Test & Verify' }).click();
  await expect(page.getByText('Verification checklist', { exact: true })).toBeVisible();
  const diagnosticWidth = await page.locator('[data-push-test-page="true"]').evaluate(el => el.getBoundingClientRect().right);
  expect(diagnosticWidth).toBeLessThanOrEqual(321);
  await page.getByRole('button', { name: 'Back to Settings' }).click();
  await expect(page.locator('[data-open-push-settings="true"]')).toBeVisible();
});
