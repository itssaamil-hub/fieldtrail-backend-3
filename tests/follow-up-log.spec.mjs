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

async function setup(page, role, failOnce = false, requireCustomerFeedback = true) {
  const actions = [];
  const edits = [];
  actions.edits = edits;
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
    else if (path === prefix + "/leads/" + DEAL + "/follow-up-logs/aaaaeeee-aaaa-4aaa-8aaa-aaaaaaaaaaaa/feedback" && req.method() === "PATCH") {
      const payload = req.postDataJSON();
      edits.push(payload);
      const event = history.find(item => item.action === "lead.follow_up_logged");
      if (event) {
        const revisions = event.follow_up_edit_history || [];
        const previous = revisions.length ? revisions[revisions.length - 1].to : event.follow_up_feedback;
        event.follow_up_edit_history = [...revisions, { from: previous, to: payload.feedback, at: new Date().toISOString(), by: role === "admin" ? "Admin" : "Anand" }];
      }
      result = { edited: true, feedback: payload.feedback };
    }
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
        follow_up_mode: payload.followUpLog.mode, follow_up_can_edit: true,
        follow_up_edit_history: [],
        old_value: "2026-11-12", new_value: payload.nextFollowUpDate,
      });
      result = { lead };
    } else if (path === "/admin/salesmen")
      result = { salesmen: [{ id: EMPLOYEE, full_name: "Anand", city: "Lucknow", is_active: true, status: "offline" }] };
    else if (path === "/admin/dashboard/summary") result = { conversationLeads: 1 };
    else if (path === "/salesman/leads-summary") result = { month: 1, today: 0, hot: 0, conversation: 1, total: 1 };
    else if (path === "/salesman/settings")
      result = { locationSettings: { gpsLocation: false, continuousGpsTracking: false },
        employeePermissions: { allowLeadWithoutStartDay: true, requireCustomerFeedback } };
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
    if (page.viewportSize()?.width < 600) {
      await page.getByRole("button", { name: "Deals", exact: true }).click();
      await page.getByRole("button", { name: "List view" }).click();
    } else {
      await page.getByRole("button", { name: "Pipeline", exact: true }).click();
    }
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
    await page.getByRole("button", { name: "activity", exact: true }).last().click();
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


for (const role of ["admin", "salesman"]) {
  test(role + " phone reveals Follow-up Log and safely edits saved feedback", async ({ page }) => {
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width: 390, height: 844 });
    const actions = await setup(page, role);
    await openDeal(page, role);
    await expect(page.getByRole("button", { name: "+ Follow-up Log", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Tomorrow", exact: true }).click();
    const log = page.locator('[aria-label="Follow-up Log"]');
    await expect(log).toBeVisible();
    await log.getByRole("combobox", { name: "Follow-up outcome" }).selectOption("callback_requested");
    await log.getByRole("textbox", { name: "Customer feedback" }).fill("Owner asked to call after lunch.");
    await log.getByRole("button", { name: "Save Follow-up" }).click();
    await expect(log).toHaveCount(0);
    expect(actions).toHaveLength(1);
    await page.getByRole("button", { name: "activity", exact: true }).last().click();
    await expect(page.getByText("Owner asked to call after lunch.")).toBeVisible();
    await page.getByRole("button", { name: "Edit follow-up note" }).click();
    const edit = page.locator('[aria-label="Edit Follow-up Note"]');
    await expect(edit).toBeVisible();
    await edit.getByRole("textbox", { name: "Edit customer feedback" }).fill("Owner asked to call after 4 PM.");
    await edit.getByRole("button", { name: "Save note" }).click();
    await expect(page.getByText("Owner asked to call after 4 PM.", { exact: true })).toBeVisible();
    await expect(page.getByText("View edit history")).toBeVisible();
    expect(actions.edits).toHaveLength(1);
    expect(actions.edits[0].feedback).toBe("Owner asked to call after 4 PM.");
    expect(actions.edits[0].requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(actions).toHaveLength(1); // Correction did not patch lead/date/status.
    expect(errors).toEqual([]);
  });
}

test("Desktop keeps its existing follow-up actions and has no mobile-only Log button", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setup(page, "admin");
  await openDeal(page, "admin");
  await expect(page.getByRole("button", { name: "+ Follow-up Log", exact: true })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Tomorrow", exact: true })).toBeVisible();
});


for (const role of ["admin", "salesman"]) {
  for (const width of [390, 1440]) {
    test(role + " retains all eight original color-coded rounded status pills at " + width + "px", async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const errors = []; page.on("pageerror", err => errors.push(err.message));
      await setup(page, role);
      await openDeal(page, role);
      await page.getByRole("button", { name: /Update status/ }).click();
      const pills = page.locator(".ft-lead-status-pills > button");
      await expect(pills).toHaveCount(8);
      const styles = await pills.evaluateAll(items => items.map(button => ({
        radius: getComputedStyle(button).borderTopLeftRadius,
        background: getComputedStyle(button).backgroundColor,
        pressed: button.getAttribute("aria-pressed"),
      })));
      // Preserve the existing eight-status palette and strong selected-state treatment.
      expect(styles.map(x => x.radius)).toEqual(Array(8).fill("999px"));
      expect(styles.map(x => x.background)).toEqual([
        "rgb(243, 244, 246)", // Cold
        "rgb(49, 95, 180)",   // Conversation (selected)
        "rgb(253, 236, 236)", // Hot
        "rgb(242, 236, 255)", // Demo
        "rgb(255, 244, 218)", // Negotiation
        "rgb(230, 246, 239)", // Won
        "rgb(244, 244, 245)", // Lost
        "rgb(234, 246, 248)", // Nurture
      ]);
      expect(styles.map(x => x.pressed)).toEqual(["false", "true", "false", "false", "false", "false", "false", "false"]);
      expect(errors).toEqual([]);
    });
  }
}


for (const width of [390, 1440]) {
  test("Employee Follow-up feedback OFF hides only the question at " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    const actions = await setup(page, "salesman", false, false);
    await openDeal(page, "salesman");
    await page.getByRole("button", { name: "Tomorrow", exact: true }).click();
    const form = page.locator('[aria-label="Follow-up Log"]');
    await expect(form).toBeVisible();
    await expect(form.getByRole("textbox", { name: "Customer feedback" })).toHaveCount(0);
    await expect(form.getByText("What did the customer say?")).toHaveCount(0);
    await form.getByRole("combobox", { name: "Follow-up outcome" }).selectOption("interested");
    await expect(form.getByRole("button", { name: "Save Follow-up" })).toBeEnabled();
    await form.getByRole("button", { name: "Save Follow-up" }).click();
    await expect(form).toHaveCount(0);
    expect(actions).toHaveLength(1);
    expect(actions[0].followUpLog).toMatchObject({ outcome: "interested", feedback: "" });
    expect(actions[0]).not.toHaveProperty("status");
    expect(actions[0]).not.toHaveProperty("notes");
    await page.getByRole("button", { name: "activity", exact: true }).last().click();
    await expect(page.getByText("Follow-up logged", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}
