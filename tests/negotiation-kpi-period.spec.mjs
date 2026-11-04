import { test, expect } from "@playwright/test";

const makeLead = (id, business, value) => ({
  id, client_uuid:id, salesman_id:"11111111-1111-4111-8111-111111111111",
  salesman_name:"Anand", business_name:business, status:"negotiation",
  deal_value:value, contact_name:"Owner", phone:"9876500000",
  created_at:"2026-08-01T08:00:00.000Z", updated_at:"2026-11-05T08:00:00.000Z",
});
const latestMonth = [
  makeLead("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","Bistro One",24000),
  makeLead("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","Cafe Two",21000),
];

for (const width of [1440,390]) {
  test("Negotiation card alone supports All time / This month at " + width + "px",async({page})=>{
    await page.setViewportSize({width,height:1000});
    const errors=[];
    const negotiatedQueries=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.route("http://127.0.0.1:9999/**",async route=>{
      const u=new URL(route.request().url()),path=u.pathname;
      let data={};
      if(path.endsWith("/dashboard-comparisons")) data={
        role:"admin",period:"weekly",
        metrics:{total:46,leadsToday:2,hotToday:0,conversation:10,
          negotiation:12,negotiationValue:180000,won:5,wonValue:65000},
        comparisons:{negotiation:{current:12,previous:9,pct:33}},
        settings:{comparisonPeriod:"weekly",showAdminComparisons:true}
      };
      else if(path==="/admin/salesmen") data={salesmen:[]};
      else if(path==="/admin/leads") {
        if(u.searchParams.get("negotiationPeriod")==="month") {
          negotiatedQueries.push(Object.fromEntries(u.searchParams));
          data={leads:latestMonth,total:2,page:1,limit:100,hasNext:false};
        } else data={leads:[],total:0,hasNext:false};
      }
      else if(path==="/admin/summary") data={conversationLeads:10};
      else if(path.includes("/tasks")) data={tasks:[],notifications:[]};
      else if(path.includes("/messages")) data={messages:[]};
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});
    });
    await page.addInitScript(()=>{
      localStorage.setItem("fieldtrail:session",JSON.stringify({
        id:"admin-negotiation-test",role:"admin",name:"Test Admin",token:"test-token"
      }));
      localStorage.setItem("engage:admin-won-period","all");
    });
    await page.goto("/");
    const card=page.locator(".engage-dashboard-stat").filter({
      has:page.locator(".engage-dashboard-stat-label").filter({hasText:/^In Negotiation$/})
    });
    const won=page.locator(".engage-dashboard-stat").filter({
      has:page.locator(".engage-dashboard-stat-label").filter({hasText:/^Won$/})
    });
    await expect(card.locator(".engage-dashboard-stat-value")).toHaveText("12");
    await expect(card).toContainText("₹1,80,000");
    await expect(won.locator(".engage-dashboard-stat-value")).toHaveText("5");
    await expect(card.getByRole("button",{name:"All time"})).toHaveAttribute("aria-pressed","true");
    await card.getByRole("button",{name:"This month"}).click();
    await expect(card.locator(".engage-dashboard-stat-value")).toHaveText("2");
    await expect(card).toContainText("₹45,000");
    await expect(card.getByRole("button",{name:"This month"})).toHaveAttribute("aria-pressed","true");
    expect(negotiatedQueries.some(q=>q.negotiationPeriod==="month"&&q.status==="negotiation"&&q.limit==="100")).toBeTruthy();
    await expect(won.locator(".engage-dashboard-stat-value")).toHaveText("5");
    await card.locator(".engage-dashboard-stat-label").click();
    await expect(page.getByText("In Negotiation · This Month")).toBeVisible();
    await expect(page.getByText("Bistro One")).toBeVisible();
    await expect(page.getByText("Cafe Two")).toBeVisible();
    await page.getByText("In Negotiation · This Month").first().press("Escape").catch(()=>{});
    // The mode buttons only change Negotiation, not the other KPI cards.
    expect(errors).toEqual([]);
  });
}
