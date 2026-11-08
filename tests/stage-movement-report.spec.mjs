import { test, expect } from "@playwright/test";

const PERSON = "11111111-1111-4111-8111-111111111111";
const stageData = scoped => ({
  month: "2026-10", salesmanId: scoped ? PERSON : "all", timezone: "Asia/Kolkata",
  totals: scoped
    ? { hot: 4, conversation: 3, negotiation: 2, won: 1 }
    : { hot: 6, conversation: 5, negotiation: 3, won: 2 },
  movements: scoped ? 10 : 16,
  employees: scoped
    ? [{ salesmanId: PERSON, employeeName: "Anand", hot: 4, conversation: 3, negotiation: 2, won: 1 }]
    : [{ salesmanId: PERSON, employeeName: "Anand", hot: 4, conversation: 3, negotiation: 2, won: 1 },
       { salesmanId: "22222222-2222-4222-8222-222222222222", employeeName: "Rahul",
         hot: 2, conversation: 2, negotiation: 1, won: 1 }]
});

for (const width of [1440, 390]) {
  test("Stage Movement report keeps historical entered-stage events on " + width + "px", async ({ page }) => {
    // Navigate using the existing desktop sidebar, then simulate the mobile
    // viewport without introducing any new navigation behavior.
    await page.setViewportSize({ width: 1440, height: 960 });
    const errors = [], summaryQueries = [], eventQueries = [];
    page.on("pageerror", err => errors.push(err.message));
    await page.route("http://127.0.0.1:9999/**", async route => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      let data = {};
      if (path === "/admin/reports/stage-movements") {
        summaryQueries.push(Object.fromEntries(url.searchParams));
        data = stageData(Boolean(url.searchParams.get("salesmanId")));
        data.month = url.searchParams.get("month");
      } else if (path === "/admin/reports/stage-movements/events") {
        eventQueries.push(Object.fromEntries(url.searchParams));
        const stage = url.searchParams.get("stage");
        data = {
          month: url.searchParams.get("month"), stage, page: 1, limit: 50,
          total: 1, hasNext: false,
          events: [{
            id: "event-1", leadId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            businessName: "October Cafe", previousStage: "conversation",
            stage, currentStatus: "won", occurredAt: "2026-10-15T05:00:00Z",
            employeeName: "Anand", salesmanId: PERSON, changedByName: "Admin"
          }]
        };
      } else if (path === "/admin/salesmen") {
        data = { salesmen: [
          {id:PERSON,full_name:"Anand",name:"Anand",status:"offline",is_active:true},
          {id:"22222222-2222-4222-8222-222222222222",full_name:"Rahul",name:"Rahul",status:"offline",is_active:true}
        ] };
      } else if (path.endsWith("/dashboard-comparisons")) {
        data = { role:"admin",period:"weekly",
          metrics:{total:10,leadsToday:1,hotToday:0,conversation:3,
            negotiation:2,negotiationValue:50000,won:1,wonValue:10000},
          comparisons:{},settings:{comparisonPeriod:"weekly",showAdminComparisons:true} };
      } else if (path.includes("/leads")) data = {leads:[],total:0,hasNext:false};
      else if (path.includes("/tasks")) data = {tasks:[],notifications:[]};
      else if (path.includes("/messages")) data = {messages:[]};
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
    });

    await page.addInitScript(() => localStorage.setItem("fieldtrail:session", JSON.stringify({
      id:"stage-report-test", role:"admin", name:"Test Admin",token:"test-token"
    })));
    await page.goto("/");
    await page.getByRole("button", { name: "Reports", exact: true }).click();
    await page.getByText("Stage Movement", { exact: true }).click();
    if (width === 390) await page.setViewportSize({ width, height: 860 });
    await expect(page.getByRole("button", {name:"Stage movement filters"})).toBeVisible();
    await page.getByRole("button", {name:"Stage movement filters"}).click();
    await page.getByLabel("Stage movement month").fill("2026-10");
    await expect(page.getByText("October 2026 · All Team")).toBeVisible();
    await page.getByRole("button", {name:"Close stage movement filters"}).click();
    await expect(page.getByText("16", {exact:true})).toBeVisible();
    await expect(page.getByRole("button",{name:/Moved to Negotiation/})).toContainText("3");
    await page.getByRole("button",{name:/Moved to Negotiation/}).click();
    await expect(page.getByText("October Cafe")).toBeVisible();
    await expect(page.getByText("Changed by: Admin")).toBeVisible();
    await expect(page.getByText("Won",{exact:true}).last()).toBeVisible();
    expect(eventQueries.some(q=>q.month==="2026-10"&&q.stage==="negotiation"&&q.page==="1")).toBeTruthy();
    await page.getByRole("button",{name:"Close movement details"}).click();
    await page.getByRole("button",{name:"Stage movement filters"}).click();
    await page.getByRole("combobox",{name:"Stage movement employee"}).selectOption(PERSON);
    await page.getByRole("button",{name:"Close stage movement filters"}).click();
    await expect(page.getByText("October 2026 · Anand")).toBeVisible();
    await expect(page.getByRole("button",{name:/Moved to Negotiation/})).toContainText("2");
    expect(summaryQueries.some(q=>q.month==="2026-10"&&q.salesmanId===PERSON)).toBeTruthy();
    expect(errors).toEqual([]);
  });
}
