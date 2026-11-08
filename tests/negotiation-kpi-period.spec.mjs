import { test, expect } from "@playwright/test";

const employeeId = "11111111-1111-4111-8111-111111111111";
const lead = (id, name, status) => ({
  id, client_uuid: id, salesman_id: employeeId, salesman_name: "Anand",
  business_name: name, status, deal_value: 24000, contact_name: "Owner",
  phone: "9876500000", created_at: "2026-10-05T08:00:00.000Z"
});

for (const width of [1440, 390]) {
  test("Admin KPI filter scopes only five cards, month and employee, with matching drill-down at " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors = [], monthRequests = [], dealRequests = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("http://127.0.0.1:9999/**", async route => {
      const url = new URL(route.request().url()), path = url.pathname;
      let data = {};
      if (path === "/admin/dashboard-comparisons/month") {
        monthRequests.push(Object.fromEntries(url.searchParams));
        const person = url.searchParams.has("salesmanId");
        data = { month: url.searchParams.get("month"), metrics: {
          total: person ? 7 : 12, hot: person ? 2 : 3,
          conversation: person ? 3 : 4, negotiation: person ? 1 : 5,
          negotiationValue: person ? 24000 : 52000,
          won: person ? 1 : 2, wonValue: person ? 15000 : 30000
        } };
      } else if (path === "/admin/dashboard-comparisons") data = {
        role: "admin", period: "weekly",
        metrics: { total: 46, leadsToday: 2, hotToday: 1, conversation: 10,
          negotiation: 12, negotiationValue: 180000, won: 5, wonValue: 65000 },
        comparisons: { negotiation: { current: 12, previous: 9, pct: 33 } },
        settings: { comparisonPeriod: "weekly", showAdminComparisons: true }
      };
      else if (path === "/admin/salesmen") data = { salesmen: [
        { id: employeeId, full_name: "Anand", status: "offline", is_active: true }
      ] };
      else if (path === "/admin/leads") {
        if (url.searchParams.has("dashboardMonth")) {
          dealRequests.push(Object.fromEntries(url.searchParams));
          const s = url.searchParams.get("status") || "cold";
          data = { leads: [lead("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "October Cafe", s)],
            total: 1, page: 1, hasNext: false };
        } else data = { leads: [], total: 0, hasNext: false };
      } else if (path === "/admin/dashboard/summary") data = { conversationLeads: 10 };
      else if (path.includes("/tasks")) data = { tasks: [], pending: 9, notifications: [] };
      else if (path.includes("/messages")) data = { messages: [] };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
    });
    await page.addInitScript(() => {
      localStorage.setItem("fieldtrail:session", JSON.stringify({
        id: "admin-month-kpi-test", role: "admin", name: "Test Admin", token: "test-token"
      }));
      localStorage.setItem("engage:admin-won-period", "all");
    });
    await page.goto("/");
    const card = label => page.locator(".engage-dashboard-stat").filter({
      has: page.locator(".engage-dashboard-stat-label").filter({ hasText: new RegExp("^" + label + "$") })
    });
    await expect(card("In Negotiation").locator(".engage-dashboard-stat-value")).toHaveText("12");
    await expect(card("Total Leads").locator(".engage-dashboard-stat-value")).toHaveText("46");
    await expect(card("Leads Today").locator(".engage-dashboard-stat-value")).toHaveText("2");
    await expect(card("Won").locator(".engage-dashboard-stat-value")).toHaveText("5");
    await expect(page.getByRole("button", { name: "Dashboard filters" })).toBeVisible();
    await page.getByRole("button", { name: "Dashboard filters" }).click();
    await page.getByRole("combobox", { name: "Dashboard month period" }).selectOption("custom");
    await page.getByRole("textbox", { name: "Dashboard choose month" }).fill("2026-10");
    await expect(card("In Negotiation").locator(".engage-dashboard-stat-value")).toHaveText("5");
    await expect(card("In Negotiation")).toContainText("₹52.0K");
    await expect(card("Conversation").locator(".engage-dashboard-stat-value")).toHaveText("4");
    await expect(card("Hot Leads").locator(".engage-dashboard-stat-value")).toHaveText("3");
    await expect(card("Total Leads").locator(".engage-dashboard-stat-value")).toHaveText("12");
    await expect(card("Won").locator(".engage-dashboard-stat-value")).toHaveText("2");
    await expect(card("Leads Today").locator(".engage-dashboard-stat-value")).toHaveText("2");
    expect(monthRequests.some(request => request.month === "2026-10")).toBeTruthy();
    await page.getByRole("button", { name: "Close dashboard filters" }).click();
    await card("In Negotiation").click();
    await expect(page.getByText("In Negotiation · October 2026")).toBeVisible();
    await expect(page.getByText("October Cafe")).toBeVisible();
    expect(dealRequests.some(q => q.status === "negotiation" && q.dashboardMonth === "2026-10" && q.limit === "100")).toBeTruthy();

    // Navigate back to the dashboard and scope to one employee.
    await page.reload();
    await page.getByRole("button", { name: "Dashboard filters" }).click();
    await page.getByRole("combobox", { name: "Dashboard month period" }).selectOption("previous");
    if (width <= 600) {
      await page.getByRole("combobox", { name: "Dashboard employee", exact: true }).selectOption(employeeId);
    } else {
      await page.getByRole("combobox", { name: "Dashboard employee desktop" }).selectOption(employeeId);
    }
    await expect(card("In Negotiation").locator(".engage-dashboard-stat-value")).toHaveText("1");
    expect(monthRequests.some(q => q.salesmanId === employeeId)).toBeTruthy();
    expect(errors).toEqual([]);
  });
}
