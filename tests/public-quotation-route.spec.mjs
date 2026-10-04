import { test, expect } from '@playwright/test';

test('public quotation route stays outside the Engage app shell', async ({ page }) => {
  await page.goto('/q/index.html?t=invalid-token', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle('Secure quotation');
  await expect(page.locator('body')).toContainText(/quotation/i);
  await expect(page.getByText('Engage needs to reload')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: /admin sections/i })).toHaveCount(0);
});
