import { test, expect } from '@playwright/test';

const metrics = { total: 62, today: 1, leadsToday: 1, hot: 0, hotToday: 0, conversation: 21, negotiation: 0, won: 12, wonValue: 131000, renewalsDue: 0 };
const comparisons = {
  total: { current: 62, previous: 28, pct: 121 },
  today: { current: 1, previous: 0, pct: null },
  leadsToday: { current: 1, previous: 0, pct: null },
  hot: { current: 0, previous: 0, pct: 0 },
  hotToday: { current: 0, previous: 0, pct: 0 },
  conversation: { current: 21, previous: 5, pct: 320 },
  negotiation: { current: 0, previous: 3, pct: -100 },
  won: { current: 3, previous: 0, pct: null },
};

for (const role of ['admin', 'salesman']) {
  for (const period of ['weekly', 'monthly']) {
    for (const width of [390, 1440]) {
      test(`${role} ${period} comparisons preserve cards and show zero baselines correctly at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('http://127.0.0.1:9999/**', async route => {
          const path = new URL(route.request().url()).pathname;
          let data = {};
          if (path.endsWith('/dashboard-comparisons')) data = {
            role, period, metrics: { ...metrics, won: role === 'admin' ? 12 : 3 }, comparisons,
            settings: { comparisonPeriod: period, showAdminComparisons: true, showEmployeeComparisons: true },
          };
          else if (path === '/admin/salesmen') data = { salesmen: [] };
          else if (path.includes('/leads')) data = { leads: [], total: 0, hasNext: false };
          else if (path.includes('/messages')) data = { messages: [] };
          else if (path.includes('/tasks')) data = { tasks: [], notifications: [] };
          else if (path.includes('/quotations')) data = { quotes: [], alerts: [] };
          else if (path === '/salesman/profile') data = { profile: { daily_target: 8, monthly_target: 200 } };
          else if (path === '/salesman/settings') data = {
            locationSettings: { gpsLocation: false, continuousGpsTracking: false, requireLocationToStartDay: false, requireLocationToEndDay: false },
            employeePermissions: { allowLeadWithoutStartDay: true },
          };
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
        });
        await page.addInitScript(role => {
          localStorage.setItem('fieldtrail:session', JSON.stringify({ id: 'comparison-test', role, name: 'Comparison Test', token: 'test-token' }));
          localStorage.setItem('engage:admin-won-period', 'all');
        }, role);
        await page.goto('/');
        const card = label => role === 'admin'
          ? page.locator('.engage-dashboard-stat').filter({ has: page.locator('.engage-dashboard-stat-label').filter({ hasText: new RegExp(`^${label}$`) }) })
          : page.locator(`[data-kpi="${label.toLowerCase()}"]`);
        const suffix = `vs last ${period === 'weekly' ? 'week' : 'month'}`;
        await expect(card(role === 'admin' ? 'Leads Today' : 'Today')).toContainText(`↑ New ${suffix}`);
        await expect(card('Won')).toContainText(`↑ New ${suffix}`);
        await expect(card(role === 'admin' ? 'Hot Leads.*' : 'Hot')).toContainText(`— Same ${suffix}`);
        await expect(card('Conversation')).toContainText(`↑ 320% ${suffix}`);
        await expect(card(role === 'admin' ? 'In Negotiation' : 'Negotiation')).toContainText(`↓ 100% ${suffix}`);
        if (role === 'admin') {
          await expect(card('Won').locator('.engage-dashboard-stat-value')).toHaveText('12');
          await expect(card('Total Leads')).toContainText(`↑ 121% ${suffix}`);
        } else {
          await expect(card('Won').getByText('3', { exact: true })).toBeVisible();
        }
        expect(errors).toEqual([]);
      });
    }
  }
}
