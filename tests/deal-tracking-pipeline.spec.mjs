import { test, expect } from "@playwright/test";

const apiBase = "http://127.0.0.1:9999";
const EMPLOYEE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CURRENT_DEAL = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OLD_TRACKED_DEAL = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const month = (() => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit",
  }).formatToParts(new Date());
  return parts.find(p => p.type === "year").value + "-" +
    parts.find(p => p.type === "month").value;
})();
const row = (id, name, stage, createdAt) => ({
  id, client_uuid: id, salesman_id: EMPLOYEE, salesman_name: "Anand",
  business_name: name, status: stage, deal_value: 17500, contact_name: "Owner",
  phone: "9876500000", created_at: createdAt, updated_at: "2026-11-07T07:00:00Z",
});
const regular = row(CURRENT_DEAL, "Normal Pipeline Cafe", "conversation", "2026-11-06T10:00:00Z");
const tracked = row(OLD_TRACKED_DEAL, "Older Tracked Bistro", "hot", "2024-05-12T10:00:00Z");
const roster = [{
  id: EMPLOYEE, full_name: "Anand", phone: "9876500000", city: "Lucknow",
  status: "offline", is_active: true, employee_code: "TEST-1",
}];
const json = (data) => ({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
async function mock(page, getMonthlyFocus = () => []) {
  const actions = [];
  await page.route(apiBase + "/**", async route => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    let data = {};
    if (p === "/admin/deal-tracking") data = { month: url.searchParams.get("month"), deals: [tracked] };
    else if (p === "/admin/leads") data = { leads: [regular], total: 1, page: 1, totalPages: 1 };
    else if (p === "/admin/salesmen") data = { salesmen: roster };
    else if (p === "/admin/dashboard/summary") data = { conversationLeads: 1 };
    else if (p === "/salesman/leads") data = { leads: [regular], total: 1, page: 1, totalPages: 1 };
    else if (p === "/salesman/leads/" + CURRENT_DEAL) data = { lead: regular };
    else if (p.endsWith("/history")) data = { history: [] };
    else if (p === "/salesman/monthly-focus" && req.method() === "GET")
      data = { month: url.searchParams.get("month"), items: getMonthlyFocus() };
    else if (p === "/salesman/monthly-focus" && req.method() === "POST") {
      actions.push({ type: "add", payload: req.postDataJSON() });
      data = { ok: true };
    } else if (p === "/salesman/monthly-focus/" + CURRENT_DEAL && req.method() === "DELETE") {
      actions.push({ type: "remove", month: url.searchParams.get("month") });
      data = { ok: true };
    } else if (p === "/notifications/sales-briefing")
      data = { followUps: { today: [], overdue: [], upcoming: [] }, priorityLeads: [] };
    else if (p === "/salesman/leads-summary")
      data = { month: 1, today: 0, hot: 0, conversation: 1, negotiation: 0, won: 0, total: 1 };
    else if (p === "/salesman/settings")
      data = { locationSettings: { gpsLocation: false, continuousGpsTracking: false },
        employeePermissions: { allowLeadWithoutStartDay: true } };
    else if (p === "/salesman/profile") data = { profile: { daily_target: 8, monthly_target: 100 } };
    else if (p.includes("/tasks")) data = { tasks: [], notifications: [] };
    else if (p.includes("/messages")) data = { messages: [] };
    else if (p.includes("/notifications")) data = {};
    else if (p === "/quotations/alerts") data = { alerts: [] };
    else if (p === "/onboarding/customers") data = { customers: [] };
    else if (p === "/collections") data = { accounts: [], summary: { collected: 0, pending: 0, overdue: 0 }, employees: [] };
    await route.fulfill(json(data));
  });
  return actions;
}
const session = role => ({
  id: role === "admin" ? "test-admin" : EMPLOYEE, role,
  name: role === "admin" ? "Admin" : "Anand", token: "test-token",
});

test("Admin desktop Pipeline filters to this month's tracked deals, including older deals", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  await mock(page);
  await page.addInitScript(value => localStorage.setItem("fieldtrail:session", JSON.stringify(value)), session("admin"));
  await page.goto("/");
  await page.getByRole("button", { name: "Pipeline", exact: true }).click();
  const pipeline = page.locator(".engage-desktop-deals");
  await expect(pipeline.getByText("Normal Pipeline Cafe")).toBeVisible();
  await pipeline.locator('select:has(option[value="tracked"])').selectOption("tracked");
  await expect(pipeline.getByText("Older Tracked Bistro")).toBeVisible();
  await expect(pipeline.getByText("Normal Pipeline Cafe")).toHaveCount(0);
  await expect(pipeline.locator('select:has(option[value="' + month + '"])')).toHaveValue(month);
  await pipeline.getByRole("button", { name: "List", exact: true }).click();
  await expect(pipeline.getByText("Older Tracked Bistro")).toBeVisible();
  expect(errors).toEqual([]);
});

test("Admin phone tracking filter stays inside Deals without adding a filter row", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  await mock(page);
  await page.addInitScript(value => localStorage.setItem("fieldtrail:session", JSON.stringify(value)), session("admin"));
  await page.goto("/");
  await page.getByRole("button", { name: "Deals", exact: true }).click();
  const deals = page.locator('section[aria-label="Admin deals"]');
  await expect(deals.getByRole("button", { name: "Flagged deals filter" })).toBeVisible();
  await deals.getByRole("button", { name: "List view" }).click();
  await expect(deals.getByText("Normal Pipeline Cafe")).toBeVisible();
  await deals.getByRole("button", { name: "Flagged deals filter" }).click();
  await deals.locator('select[aria-label="Flagged deals view"]').selectOption("tracked");
  // Selecting a view applies immediately and closes the menu; there is no Apply button.
  await expect(deals.getByRole("button", { name: "Apply", exact: true })).toHaveCount(0);
  await expect(deals.locator('select[aria-label="Flagged deals view"]')).toHaveCount(0);
  await expect(deals.getByText("Older Tracked Bistro")).toBeVisible();
  await expect(deals.getByText("Normal Pipeline Cafe")).toHaveCount(0);
  await expect(deals.getByRole("button", { name: "Flagged deals filter" })).toHaveAttribute("aria-pressed", "true");
  // Reopen the same small menu to pick another month; that also applies instantly.
  await deals.getByRole("button", { name: "Flagged deals filter" }).click();
  const previousMonthRequest = page.waitForRequest(req => {
    const url = new URL(req.url());
    return url.pathname === "/admin/deal-tracking" && url.searchParams.get("month") !== month;
  });
  await deals.locator('select[aria-label="Flagged deals month"]').selectOption({ index: 1 });
  await previousMonthRequest;
  await expect(deals.locator('select[aria-label="Flagged deals month"]')).toHaveCount(0);
  // Going back to All Deals must also immediately restore the regular pipeline.
  await deals.getByRole("button", { name: "Flagged deals filter" }).click();
  await deals.locator('select[aria-label="Flagged deals view"]').selectOption("all");
  await expect(deals.getByText("Normal Pipeline Cafe")).toBeVisible();
  await expect(deals.getByText("Older Tracked Bistro")).toHaveCount(0);
  await expect(deals.getByRole("button", { name: "Flagged deals filter" })).toHaveAttribute("aria-pressed", "false");
  await expect(deals.locator('select[aria-label="Employee"]')).toBeVisible();
  await expect(deals.locator('select[aria-label="Deal status"]')).toBeVisible();
  expect(errors).toEqual([]);
});

test("Employee Flag Deal uses monthly focus only and leaves CRM status unchanged", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  let added = false;
  const actions = await mock(page, () => added ? [{ ...regular, added_at: "2026-11-07T07:00:00Z" }] : []);
  await page.route(apiBase + "/salesman/monthly-focus", async route => {
    if (route.request().method() !== "POST") return route.fallback();
    added = true;
    actions.push({ type: "add", payload: route.request().postDataJSON() });
    await route.fulfill(json({ ok: true }));
  });
  await page.route(apiBase + "/salesman/monthly-focus/" + CURRENT_DEAL, async route => {
    if (route.request().method() !== "DELETE") return route.fallback();
    added = false;
    actions.push({ type: "remove", month: new URL(route.request().url()).searchParams.get("month") });
    await route.fulfill(json({ ok: true }));
  });
  await page.addInitScript(value => localStorage.setItem("fieldtrail:session", JSON.stringify(value)), session("salesman"));
  await page.goto("/#lead=" + CURRENT_DEAL);
  await expect(page.getByText("Recommended next action", { exact: false }).last()).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).last().click();
  await page.getByRole("button", { name: /Update status/ }).click();
  const track = page.getByRole("button", { name: "Flag Deal", exact: true });
  await expect(track).toBeVisible();
  await track.click();
  await expect(page.getByRole("button", { name: "Unflag Deal" })).toBeVisible();
  await page.getByRole("button", { name: "Unflag Deal" }).click();
  await expect(page.getByRole("button", { name: "Flag Deal", exact: true })).toBeVisible();
  expect(actions).toEqual([
    { type: "add", payload: { month, leadId: CURRENT_DEAL } },
    { type: "remove", month },
  ]);
  expect(errors).toEqual([]);
});
