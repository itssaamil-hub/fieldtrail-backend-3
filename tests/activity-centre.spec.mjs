import {test,expect} from '@playwright/test';
const base='http://127.0.0.1:9999';
const leadId='33333333-3333-4333-8333-333333333333';
const event={id:'audit:1',action:'lead.status_changed',title:'Lead status changed',category:'sales',actorName:'Anand',entityType:'lead',entityId:leadId,leadId,recordLabel:'Dubai Darbar',from:'conversation',to:'hot',createdAt:'2026-10-01T06:30:00Z'};
async function boot(page,role='admin') {
 await page.addInitScript(role=>localStorage.setItem('fieldtrail:session',JSON.stringify({id:'11111111-1111-4111-8111-111111111111',role,fullName:'Test Admin',token:'isolated-ui-test'})),role);
 await page.route(`${base}/**`,async route=>{
  const u=new URL(route.request().url());let data={};
  if(u.pathname==='/admin/activity-centre/feed') {
   const empty=u.searchParams.get('category')==='payments'||u.searchParams.get('search')==='No match';
   data={activities:empty?[]:[{...event,id:'audit:'+u.searchParams.get('offset')}],summary:{total:empty?0:31,leadsAdded:0,statusChanges:empty?0:31,quotesSent:0,tasksCompleted:0,payments:[]},hasMore:!empty&&Number(u.searchParams.get('offset'))===0};
  } else if(u.pathname.startsWith('/admin/activity-centre/lead/')) data={lead:{id:leadId,business_name:'Dubai Darbar',status:'hot',created_at:'2026-10-01T06:30:00Z',salesman_id:'22222222-2222-4222-8222-222222222222'}};
  else if(u.pathname==='/admin/activity-centre/overview')data={activities:[],trend:[],totals:{}};
  else if(u.pathname==='/admin/salesmen')data={salesmen:[]};
  else if(u.pathname.startsWith('/admin/leads'))data={leads:[],total:0,history:[]};
  else if(u.pathname.startsWith('/tasks'))data={tasks:[],notifications:[],hasMore:false};
  else if(u.pathname==='/salesman/leads')data={leads:[],total:0};
  else if(u.pathname==='/salesman/messages')data={messages:[]};
  else if(u.pathname.includes('notifications'))data={notifications:[],unreadCount:0};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('/');
}
test('desktop sidebar opens activity, filters, pages, details and exact linked lead',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await boot(page);await page.getByRole('button',{name:'Activity Centre',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Activity Centre',exact:true})).toBeVisible();
 await expect(page.getByText('31 recorded events')).toBeVisible();
 await page.locator('.ac-row').click();await expect(page.getByLabel('Selected activity details')).toContainText('Conversation');
 await page.getByRole('button',{name:'Close activity details'}).click();await expect(page.locator('.ac-row')).toBeFocused();
 await page.getByRole('button',{name:'Next',exact:true}).click();await expect(page.getByText('Page 2')).toBeVisible();
 await page.getByRole('tab',{name:'Payments',exact:true}).click();await expect(page.getByText('No activity in this selection')).toBeVisible();await expect(page.getByText('Page 1')).toBeVisible();
 await page.getByRole('tab',{name:'All activity'}).click();await page.getByLabel('Search activity').fill('No match');await expect(page.getByText('No activity in this selection')).toBeVisible();
 await page.getByLabel('Search activity').fill('');await page.locator('.ac-row').click();
 await page.screenshot({path:test.info().outputPath('activity-page.png'),fullPage:true});
 await page.getByRole('button',{name:'Open lead',exact:true}).click();await expect(page.locator('.ac-page')).toHaveCount(0);await expect(page.getByText('Dubai Darbar',{exact:true}).first()).toBeVisible();
 expect(errors).toEqual([]);
});
test('dashboard View all opens the same page and feed errors allow retry',async({page})=>{
 await boot(page);await page.getByRole('button',{name:'View all',exact:true}).click();await expect(page.locator('.ac-row')).toBeVisible();
 await page.route(`${base}/admin/activity-centre/feed?**`,route=>route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Activity unavailable'})}));
 await page.getByRole('button',{name:'Refresh',exact:true}).click();await expect(page.getByText('Activity unavailable')).toBeVisible();await expect(page.getByRole('button',{name:'Retry'})).toBeVisible();
 await expect(page.locator('.ac-stat strong').first()).toHaveText('—');
});
test('mobile admin navigation is unchanged: no Activity Centre sidebar button',async({page})=>{
 await page.setViewportSize({width:390,height:844});await boot(page);
 await expect(page.getByRole('button',{name:'Activity Centre',exact:true})).toHaveCount(0);
 await expect(page.locator('body')).not.toContainText('Engage needs to reload');
});
