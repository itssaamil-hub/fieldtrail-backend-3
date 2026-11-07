import { test, expect } from "@playwright/test";

const API = "http://127.0.0.1:9999";
const EMPLOYEE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DEAL_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const lead = {
  id: DEAL_ID, client_uuid: DEAL_ID, salesman_id: EMPLOYEE,
  salesman_name: "Anand", business_name: "Admin Control Cafe",
  contact_name: "Customer", phone: "9876500000", status: "conversation",
  deal_value: 25000, created_at: "2026-09-01T08:00:00Z",
  updated_at: "2026-11-07T08:00:00Z",
};
function currentMonth() {
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit",
  }).formatToParts(new Date());
  return date.find(p => p.type === "year").value + "-" +
    date.find(p => p.type === "month").value;
}
for (const width of [390, 1440]) {
  test("Admin Update Status shows Track Deal and keeps chevron far-right at " + width + "px", async ({ page }) => {
    const actions = [];
    const errors = [];
    let tracked = false;
    page.on("pageerror", e => errors.push(e.message));
    await page.setViewportSize({ width, height: 900 });
    await page.route(API + "/**", async route => {
      const request = route.request(), url = new URL(request.url());
      const path = url.pathname, method = request.method();
      let output = {};
      if (path === "/admin/leads") output = { leads: [lead], total: 1, page: 1, totalPages: 1 };
      else if (path === "/admin/salesmen")
        output = { salesmen: [{ id: EMPLOYEE, full_name: "Anand", city: "Lucknow", is_active: true, status: "offline" }] };
      else if (path === "/admin/deal-tracking/" + DEAL_ID && method === "GET")
        output = { month: currentMonth(), tracked };
      else if (path === "/admin/deal-tracking/" + DEAL_ID && method === "POST") {
        tracked = true;
        actions.push({ method, body: request.postDataJSON() });
        output = { ok: true, tracked: true };
      } else if (path === "/admin/deal-tracking/" + DEAL_ID && method === "DELETE") {
        tracked = false;
        actions.push({ method, month: url.searchParams.get("month") });
        output = { ok: true, tracked: false };
      } else if (path.endsWith("/history")) output = { history: [] };
      else if (path === "/admin/dashboard/summary") output = { conversationLeads: 1 };
      else if (path === "/tasks" || path.includes("/tasks")) output = { tasks: [], notifications: [] };
      else if (path.includes("/messages")) output = { messages: [] };
      else if (path === "/quotations/alerts") output = { alerts: [] };
      else if (path === "/onboarding/customers") output = { customers: [] };
      else if (path === "/collections") output = { accounts: [], summary: { collected: 0, pending: 0, overdue: 0 }, employees: [] };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(output) });
    });
    await page.addInitScript(() => {
      localStorage.setItem("fieldtrail:session", JSON.stringify({
        id: "test-admin", role: "admin", name: "Test Admin", token: "test-token",
      }));
    });
    await page.goto("/");
    if (width < 600) {
      await page.getByRole("button", { name: "Deals", exact: true }).click();
      await page.getByRole("button", { name: "List view" }).click();
    } else {
      await page.getByRole("button", { name: "Pipeline", exact: true }).click();
    }
    await page.getByText("Admin Control Cafe", { exact: true }).first().click();
    const update = page.getByRole("button", { name: /Update status/ }).first();
    await expect(update).toBeVisible();
    await update.click();
    const track = page.getByRole("button", { name: "Track Deal", exact: true });
    const arrow = page.getByRole("button", { name: "Collapse section" });
    await expect(track).toBeVisible();
    await expect(arrow).toBeVisible();
    const trackBox = await track.boundingBox(), arrowBox = await arrow.boundingBox();
    expect(trackBox).not.toBeNull();
    expect(arrowBox.x).toBeGreaterThan(trackBox.x + trackBox.width - 1);
    await track.click();
    await expect(page.getByRole("button", { name: "Stop tracking deal" })).toBeVisible();
    await expect(arrow).toBeVisible();
    await page.getByRole("button", { name: "Stop tracking deal" }).click();
    await expect(track).toBeVisible();
    await arrow.click();
    await expect(page.getByRole("button", { name: "Expand section" })).toBeVisible();
    await expect(track).toHaveCount(0);
    expect(actions).toEqual([
      { method: "POST", body: { month: currentMonth() } },
      { method: "DELETE", month: currentMonth() },
    ]);
    expect(errors).toEqual([]);
  });
}
