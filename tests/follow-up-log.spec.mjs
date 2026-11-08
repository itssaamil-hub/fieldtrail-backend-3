import { test, expect } from "@playwright/test";

const API = "http://127.0.0.1:9999";
const EMPLOYEE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DEAL = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const baseLead = {
  id: DEAL, client_uuid: DEAL, salesman_id: EMPLOYEE, salesman_name: "Anand",
  business_name: "Follow-up Log Cafe", contact_name: "Customer", phone: "9876500000",
  status: "conversation", notes: "Existing CRM comments stay unchanged",
  next_follow_up_date: "2026-11-12", deal_value: 18000,
  created_at: "2026-11-05T08:00:00Z", updated_at: "2026-11-07T08:00:00Z",
};
const json = data => ({ status: 200, contentType: "application/json", body: JSON.stringify(data) });

async function setup(page, role, failOnce = false) {
  const actions = [];
  const history = [];
  let lead = { ...baseLead };
  let failed = false;
  await page.route(API + "/**", async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    const prefix = role === "admin" ? "/admin" : "/salesman";
    let result = {};
    if (path === prefix + "/leads" && req.method() === "GET")
      result = { leads: [lead], page: 1, total: 1, totalPages: 1 };
    else if (path === prefix + "/leads/" + DEAL && req.method() === "GET")
      result = { lead };
    else if (path === prefix + "/leads/" + DEAL + "/history" && req.method() === "GET")
      result = { history };
    else if (path === prefix + "/leads/" + DEAL && req.method() === "PATCH") {
      const payload = req.postDataJSON();
      actions.push(payload);
      if (failOnce && !failed) {
        failed = true;
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Try again" }) });
        return;
      }
      lead = { ...lead, next_follow_up_date: payload.nextFollowUpDate, updated_at: new Date().toISOString() };
      history.push({
        id: "aaaaeeee-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        action: "lead.follow_up_logged", changed_by_name: role === "admin" ? "Admin" : "Anand",
        changed_at: new Date().toISOString(),
        follow_up_outcome: payload.followUpLog.outcome,
        follow_up_feedback: payload.followUpLog.feedback,
        follow_up_mode: payload.followUpLog.mode,
        old_value: "2026-11-12", new_value: payload.nextFollowUpDate,
      });
      result = { lead };
    } else if (path === "/admin/salesmen")
      result = { salesmen: [{ id: EMPLOYEE, full_name: "Anand", city: "Lucknow", is_active: true, status: "offline" }] };
    else if (path === "/admin/dashboard/summary") result = { conversationLeads: 1 };
    else if (path === "/salesman/leads-summary") result = { month: 1, today: 0, hot: 0, conversation: 1, total: 1 };
    else if (path === "/salesman/settings")
      result = { locationSettings: { gpsLocation: false, continuousGpsTracking: false },
        employeePermissions: { allowLeadWithoutStartDay: true } };
    else if (path === "/salesman/profile")
      result = { profile: { daily_target: 8, monthly_target: 100 } };
    else if (path === "/notifications/sales-briefing")
      result = { followUps: { today: [], overdue: [], upcoming: [] }, priorityLeads: [] };
    else if (path.includes("/tasks")) result = { tasks: [], notifications: [] };
    else if (path.includes("/messages")) result = { messages: [] };
    else if (path.includes("/notifications")) result = {};
    else if (path === "/quotations/alerts") result = { alerts: [] };
    else if (path === "/onboarding/customers") result = { customers: [] };
    else if (path === "/collections") result = { accounts: [], summary: { collected: 0, pending: 0, overdue: 0 }, employees: [] };
    await route.fulfill(json(result));
  });
  await page.addInitScript(value => localStorage.setItem("fieldtrail:session", JSON.stringify(value)), {
    id: role === "admin" ? "test-admin" : EMPLOYEE, role, name: role === "admin" ? "Admin" : "Anand", token: "test-token",
  });
  return actions;
}

async function openDeal(page, role) {
  if (role === "admin") {
    await page.goto("/");
    await page.getByRole("button", { name: "Pipeline", exact: true }).click();
    await page.getByText("Follow-up Log Cafe", { exact: true }).first().click();
  } else {
    await page.goto("/#lead=" + DEAL);
    await expect(page.getByText("Recommended next action", { exact: false }).last()).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).last().click();
  }
  await page.getByText("Next Follow-up", { exact: true }).last().click();
}

for (const role of ["admin", "salesman"]) {
  test(role + " saves customer response from Tomorrow and displays it in Activity", async ({ page }) => {
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width: role === "admin" ? 1440 : 390, height: 900 });
    const actions = await setup(page, role);
    await openDeal(page, role);
    await page.getByRole("button", { name: "Tomorrow", exact: true }).click();
    const form = page.locator('[aria-label="Follow-up Log"]');
    await expect(form).toBeVisible();
    await form.getByRole("combobox", { name: "Follow-up outcome" }).selectOption("interested");
    await expect(form.getByRole("button", { name: "Save Follow-up" })).toBeDisabled();
    await form.getByRole("textbox", { name: "Customer feedback" }).fill("Owner asked for the Swirl POS demo tomorrow.");
    await form.getByRole("button", { name: "Save Follow-up" }).click();
    await expect(form).toHaveCount(0);
    expect(actions).toHaveLength(1);
    expect(actions[0].followUpLog).toMatchObject({
      mode: "reschedule", outcome: "interested", feedback: "Owner asked for the Swirl POS demo tomorrow.",
    });
    expect(actions[0].followUpLog.requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(actions[0].nextFollowUpDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(actions[0]).not.toHaveProperty("notes");
    expect(actions[0]).not.toHaveProperty("status");
    await page.getByRole("button", { name: "Activity", exact: true }).last().click();
    await expect(page.getByText("Follow-up logged", { exact: true })).toBeVisible();
    await expect(page.getByText("Owner asked for the Swirl POS demo tomorrow.")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test(role + " permits No Answer without feedback on Mark Done", async ({ page }) => {
    await page.setViewportSize({ width: role === "admin" ? 1440 : 390, height: 900 });
    const actions = await setup(page, role);
    await openDeal(page, role);
    await page.getByRole("button", { name: /Mark Done/ }).click();
    const form = page.locator('[aria-label="Follow-up Log"]');
    await form.getByRole("combobox", { name: "Follow-up outcome" }).selectOption("no_answer");
    await expect(form.getByRole("button", { name: "Save Follow-up" })).toBeEnabled();
    await form.getByRole("button", { name: "Save Follow-up" }).click();
    await expect(form).toHaveCount(0);
    expect(actions).toHaveLength(1);
    expect(actions[0].nextFollowUpDate).toBeNull();
    expect(actions[0].followUpLog).toMatchObject({ mode: "done", outcome: "no_answer", feedback: "" });
  });
}

test("Salesman failed Follow-up Log retains unsaved draft and allows retry", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const actions = await setup(page, "salesman", true);
  await openDeal(page, "salesman");
  await page.getByRole("button", { name: "Tomorrow", exact: true }).click();
  const form = page.locator('[aria-label="Follow-up Log"]');
  await form.getByRole("combobox", { name: "Follow-up outcome" }).selectOption("callback_requested");
  await form.getByRole("textbox", { name: "Customer feedback" }).fill("Call after checking inventory requirements.");
  await form.getByRole("button", { name: "Save Follow-up" }).click();
  await expect(form.getByRole("alert")).toContainText("Try again");
  await expect(form.getByRole("textbox", { name: "Customer feedback" })).toHaveValue("Call after checking inventory requirements.");
  await form.getByRole("button", { name: "Save Follow-up" }).click();
  await expect(form).toHaveCount(0);
  expect(actions).toHaveLength(2);
  expect(actions[0].followUpLog.requestId).toBe(actions[1].followUpLog.requestId);
});
