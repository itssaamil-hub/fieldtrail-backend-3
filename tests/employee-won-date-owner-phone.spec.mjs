import { test, expect } from "@playwright/test";

const EMPLOYEE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const mkRow = (n, name, owner = EMPLOYEE) => ({
  id: "00000000-0000-4000-8000-" + String(n).padStart(12, "0"),
  client_uuid: "00000000-0000-4000-8000-" + String(n).padStart(12, "0"),
  business_name: name, salesman_id: owner,
  status: "won", deal_value: n === 1 ? 15000 : 8000,
  contact_name: "Restaurant Owner", phone: "9876543210",
  created_at: "2025-07-07T08:00:00Z",
  won_date: "2026-11-08",
});
for (const width of [390, 1440]) {
  test("Salesman Won list reads backdated owner deals with paged saved dates at " + width + "px", async ({ page }) => {
    await page.setViewportSize({width,height:950});
    const errors = [], requests = [];
    let forbiddenAdminWonDateCalls = 0;
    let wonCount = 2;
    page.on("pageerror", e=>errors.push(e.message));
    await page.route("http://127.0.0.1:9999/**", async route => {
      const u = new URL(route.request().url()), path = u.pathname;
      let data = {};
      if (path === "/salesman/won-leads") {
        requests.push({period:u.searchParams.get("period"),page:u.searchParams.get("page")});
        const period = u.searchParams.get("period");
        const p = Number(u.searchParams.get("page"));
        data = period === "month" ? {
          period,total:2,wonValue:23000,page:p,hasNext:p===1,
          leads:p===1?[mkRow(1,"Backdated Restaurant")]:[mkRow(2,"Second Won Restaurant")]
        } : {
          period,total:3,wonValue:26000,page:p,hasNext:false,
          leads:[mkRow(1,"Backdated Restaurant"),mkRow(2,"Second Won Restaurant"),
            {...mkRow(3,"Historical Won Restaurant"),won_date:"2026-09-22",deal_value:3000}],
        };
      } else if (path === "/salesman/leads") {
        // The ordinary 50-row feed does not include the historical Won deal.
        data = {leads:[],total:150,page:1,totalPages:3,hasNext:true};
      } else if (path === "/salesman/dashboard-comparisons") {
        data = {role:"salesman",period:"weekly",metrics:{
          today:0,hot:0,conversation:0,negotiation:0,negotiationValue:0,
          won:wonCount,wonValue:23000,renewalsDue:0},comparisons:{},
          settings:{comparisonPeriod:"weekly",showEmployeeComparisons:true}};
      } else if (path === "/salesman/leads-summary") {
        data = {total:150,today:0,month:0,hot:0,conversation:0,
          negotiation:0,won:wonCount,wonValue:23000};
      } else if (path === "/salesman/monthly-focus") {
        data = {items:[],month:u.searchParams.get("month")};
      } else if (path === "/notifications/sales-briefing") {
        data = {followUps:{today:[],overdue:[],upcoming:[]},priorityLeads:[]};
      } else if (path === "/salesman/profile") {
        data = {profile:{daily_target:8,monthly_target:20}};
      } else if (path === "/salesman/settings") {
        data = {locationSettings:{gpsLocation:false,continuousGpsTracking:false,requireLocationToStartDay:false,requireLocationToEndDay:false},
          employeePermissions:{allowLeadWithoutStartDay:true}};
      } else if (path.includes("/tasks")) data = {tasks:[],notifications:[]};
      else if (path.includes("/messages")) data = {messages:[]};
      else if (path.includes("/admin/leads/")) {
        forbiddenAdminWonDateCalls += 1;
        await route.fulfill({status:403,contentType:"application/json",body:JSON.stringify({error:"Requires admin role"})});
        return;
      }
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});
    });
    await page.addInitScript(id=>localStorage.setItem("fieldtrail:session",JSON.stringify({
      id,role:"salesman",fullName:"Anand",token:"employee-won-test-token"
    })), EMPLOYEE);
    await page.goto("/");
    const card = page.locator('[data-kpi="won"]');
    await expect(card).toContainText("2");
    await card.click();
    await expect(page.getByText("Backdated Restaurant")).toBeVisible();
    await expect(page.getByText("Second Won Restaurant")).toHaveCount(0);
    await page.getByRole("button",{name:/Load more leads/}).click();
    await expect(page.getByText("Second Won Restaurant")).toBeVisible();
    expect(requests.some(q=>q.period==="month"&&q.page==="1")).toBeTruthy();
    expect(requests.some(q=>q.period==="month"&&q.page==="2")).toBeTruthy();
    await page.getByRole("button",{name:"All time",exact:true}).click();
    await expect(page.getByText("Historical Won Restaurant")).toBeVisible();
    expect(requests.some(q=>q.period==="all")).toBeTruthy();
    await page.getByRole("button",{name:"This month",exact:true}).click();
    await expect(page.getByText("Historical Won Restaurant")).toHaveCount(0);
    // Protected Admin Won Date route must never be called as salesman.
    expect(errors).toEqual([]);
    expect(forbiddenAdminWonDateCalls).toBe(0);
    expect(requests.length).toBeGreaterThan(0);
    wonCount=3;
    // Phone KPI can change after admin saves the corrected date, on focus.
    await page.keyboard.press("Escape");
    await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
    await expect(card).toContainText("3");
    await expect(card).toBeVisible();
    expect(OTHER).not.toEqual(EMPLOYEE);
  });
}
