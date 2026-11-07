import { test, expect } from "@playwright/test";

const EMPLOYEE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ID_2 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
function indiaMonth() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit",
  }).formatToParts(new Date());
  return parts.find(p => p.type === "year").value + "-" + parts.find(p => p.type === "month").value;
}
function previousMonth(month) {
  const [y,m] = month.split("-").map(Number);
  return new Date(Date.UTC(y,m-2,1)).toISOString().slice(0,7);
}
const date = "2026-11-07T05:30:00.000Z";
const row = (id, name, stage, value) => ({
  id, business_name:name, status:stage, deal_value:value,
  created_at:date, updated_at:date, next_follow_up_date:null,
  contact_name:"Restaurant owner",phone:"1234567890", salesman_id:EMPLOYEE,
  added_at:date, completed_at:null,
});

for(const width of [320,390,1440]) {
  test("My Deals This Month is scoped, editable, persistent and above Needs Attention at " + width + "px",async({page})=>{
    const current=indiaMonth();
    const previous=previousMonth(current);
    const errors=[];
    page.on("pageerror",err=>errors.push(err.message));
    let selected=[row(ID_1,"Brew Station","hot",12000)];
    const search=[row(ID_1,"Brew Station","hot",12000),row(ID_2,"Urban Terrace","negotiation",18000)];
    const actions=[];
    await page.setViewportSize({width,height:950});
    await page.route("http://127.0.0.1:9999/**",async route=>{
      const request=route.request();
      const url=new URL(request.url());
      const path=url.pathname;
      let output={};
      let status=200;
      if(path==="/salesman/monthly-focus"&&request.method()==="GET") {
        output={month:url.searchParams.get("month"),items:url.searchParams.get("month")===current?selected:[row(ID_1,"Historical Bistro","hot",11000)]};
      } else if(path==="/salesman/monthly-focus/search") {
        output={leads:search.filter(x=>x.business_name.toLowerCase().includes((url.searchParams.get("q")||"").toLowerCase()))};
      } else if(path==="/salesman/monthly-focus"&&request.method()==="POST") {
        const body=request.postDataJSON();
        actions.push({method:"POST",body});
        selected=[...selected,row(body.leadId,"Urban Terrace","negotiation",18000)];
        output={ok:true};
      } else if(path.startsWith("/salesman/monthly-focus/")) {
        const id=path.split("/").at(-1);
        if(request.method()==="PATCH") {
          const body=request.postDataJSON();
          actions.push({method:"PATCH",body,id});
          selected=selected.map(x=>x.id===id?{...x,completed_at:body.completed?date:null}:x);
        } else if(request.method()==="DELETE") {
          actions.push({method:"DELETE",id});
          selected=selected.filter(x=>x.id!==id);
        }
        output={ok:true};
      } else if(path.endsWith("/dashboard-comparisons")) {
        output={role:"salesman",period:"weekly",
          settings:{comparisonPeriod:"weekly",showEmployeeComparisons:true},
          metrics:{today:0,hot:1,conversation:0,negotiation:1,won:0,wonValue:0,renewalsDue:0},
          comparisons:{}};
      } else if(path==="/salesman/leads-summary") {
        output={month:1,today:0,hot:1,conversation:0,negotiation:1,won:0,total:2};
      } else if(path==="/salesman/leads") {
        output={leads:search,total:2,page:1,totalPages:1,hasNext:false};
      } else if(path==="/notifications/sales-briefing") {
        output={followUps:{today:[],overdue:[],upcoming:[]},priorityLeads:[]};
      } else if(path==="/salesman/settings") {
        output={locationSettings:{gpsLocation:false,continuousGpsTracking:false,requireLocationToStartDay:false,requireLocationToEndDay:false},
          employeePermissions:{allowLeadWithoutStartDay:true}};
      } else if(path==="/salesman/profile") {
        output={profile:{daily_target:8,monthly_target:100}};
      } else if(path.includes("/tasks")) output={tasks:[],notifications:[]};
      else if(path.includes("/messages")) output={messages:[]};
      await route.fulfill({status,contentType:"application/json",body:JSON.stringify(output)});
    });
    await page.addInitScript(id=>{
      localStorage.setItem("fieldtrail:session",JSON.stringify({
        id,role:"salesman",fullName:"Anand",token:"focus-test-token",
      }));
    },EMPLOYEE);
    await page.goto("/");
    const focus=page.locator('section[aria-label="My Deals This Month"]');
    await expect(focus).toBeVisible();
    await expect(focus.getByText("Brew Station")).toBeVisible();
    await expect(focus.getByRole("button",{name:"Working",exact:true})).toBeVisible();
    const attention=page.getByText("Needs Attention",{exact:true}).first();
    await expect(attention).toBeVisible();
    const fbox=await focus.boundingBox();
    const abox=await attention.boundingBox();
    expect(fbox.y).toBeLessThan(abox.y);
    expect(await focus.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBeTruthy();
    await expect(focus.getByRole("button",{name:"Mark done Brew Station"})).toHaveCount(0);
    await expect(focus.getByRole("button",{name:"Remove Brew Station from month"})).toHaveCount(0);
    await focus.getByRole("button",{name:"Add to Month",exact:true}).click();
    await focus.getByRole("textbox",{name:"Search my existing deals"}).fill("Urban");
    await expect(focus.getByText("Urban Terrace")).toBeVisible();
    await focus.getByRole("button",{name:"Add Urban Terrace to my month"}).click();
    await expect(focus.getByText("Urban Terrace")).toBeVisible();
    expect(actions.some(x=>x.method==="POST"&&x.body.leadId===ID_2&&x.body.month===current)).toBeTruthy();
    await focus.getByRole("button",{name:"Options for Brew Station"}).click();
    await expect(focus.getByRole("button",{name:"Mark done Brew Station"})).toBeVisible();
    await expect(focus.getByRole("button",{name:"Remove Brew Station from month"})).toBeVisible();
    await expect(focus.getByRole("button",{name:"View Brew Station deal"})).toBeVisible();
    await focus.getByRole("button",{name:"Options for Brew Station"}).click();
    await expect(focus.getByRole("button",{name:"Mark done Brew Station"})).toHaveCount(0);
    await focus.getByRole("button",{name:"Options for Brew Station"}).click();
    await focus.getByRole("button",{name:"Mark done Brew Station"}).click();
    await focus.getByRole("button",{name:"Completed",exact:true}).click();
    await expect(focus.getByText("Brew Station")).toBeVisible();
    await expect(focus.getByRole("button",{name:"Reopen Brew Station"})).toHaveCount(0);
    await focus.getByRole("button",{name:"Options for Brew Station"}).click();
    await focus.getByRole("button",{name:"Reopen Brew Station"}).click();
    await expect(focus.getByText("No deals in this view.")).toBeVisible();
    await focus.locator('select[aria-label="Monthly deal focus month"]').selectOption(previous);
    await expect(focus.getByText(/Past months are saved for review/)).toBeVisible();
    await expect(focus.getByRole("button",{name:"Add to Month",exact:true})).toHaveCount(0);
    await expect(focus.getByRole("button",{name:"Options for Historical Bistro"})).toBeVisible();
    await focus.getByRole("button",{name:"Options for Historical Bistro"}).click();
    await expect(focus.getByRole("button",{name:"View Historical Bistro deal"})).toBeVisible();
    await expect(focus.getByRole("button",{name:"Remove Historical Bistro from month"})).toHaveCount(0);
    await expect(focus.getByRole("button",{name:"Mark done Historical Bistro"})).toHaveCount(0);
    await focus.locator('select[aria-label="Monthly deal focus month"]').selectOption(current);
    await focus.getByRole("button",{name:"Working",exact:true}).click();
    await expect(focus.getByText("Urban Terrace")).toBeVisible();
    await expect(focus.getByText("Brew Station")).toBeVisible();
    expect(actions.filter(x=>x.method==="PATCH").map(x=>x.body.completed)).toEqual([true,false]);
    await focus.getByRole("button",{name:"Options for Urban Terrace"}).click();
    await focus.getByRole("button",{name:"Remove Urban Terrace from month"}).click();
    await expect(focus.getByText("Urban Terrace")).toHaveCount(0);
    expect(actions.some(x=>x.method==="DELETE"&&x.id===ID_2)).toBeTruthy();
    expect(await focus.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBeTruthy();
    expect(errors).toEqual([]);
  });
}
