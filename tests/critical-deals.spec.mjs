import {test,expect} from '@playwright/test';
const base='http://127.0.0.1:9999',id='22222222-2222-4222-8222-222222222222';
const lead={id,client_uuid:id,business_name:'Critical Cafe',contact_name:'Customer',phone:'9999999999',salesman_id:'employee',salesman_name:'Employee',status:'conversation',deal_value:100,created_at:'2026-09-01T00:00:00Z',verification_status:'verified'};
async function boot(page,role){
 await page.route(`${base}/**`,async route=>{
  const request=route.request(),url=new URL(request.url());let body={};
  if(request.method()==='PATCH'&&url.pathname===`/salesman/leads/${id}`)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Save failed. Please retry.'})});
  if(url.pathname==='/salesman/leads')body={leads:[lead],total:1,totalPages:1,page:1};
  if(url.pathname===`/salesman/leads/${id}`||url.pathname===`/admin/activity-centre/lead/${id}`)body={lead};
  if(url.pathname==='/admin/leads')body={leads:[],total:0};
  if(url.pathname==='/admin/salesmen')body={salesmen:[]};
  if(url.pathname.endsWith('/history'))body={history:[]};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.addInitScript(r=>localStorage.setItem('fieldtrail:session',JSON.stringify({id:r==='admin'?'admin':'employee',role:r,fullName:'Employee',token:'test-token'})),role);
 await page.goto('/#lead='+id);
}
for(const role of ['admin','salesman'])test(`notification opens the exact Brief even outside loaded leads: ${role}`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await boot(page,role);
 await expect(page.getByText('Recommended next action',{exact:false}).last()).toBeVisible();await expect(page.locator('body')).toContainText('Critical Cafe');
 expect(errors).toEqual([]);
});
test('failed edits keep the form open, preserve saved values and report failure',async({page})=>{
 await boot(page,'salesman');await expect(page.getByText('Recommended next action',{exact:false}).last()).toBeVisible();
 // Dismiss only the Brief overlay; the existing detail drawer stays open.
 await page.getByRole('button',{name:'Close',exact:true}).last().click();
 await page.getByRole('button',{name:/Edit$/}).click();
 await page.getByPlaceholder('Business / Restaurant name').fill('Unsaved name');
 const dialog=page.waitForEvent('dialog');await page.getByRole('button',{name:'Save changes',exact:true}).click();const alert=await dialog;expect(alert.message()).toContain('Save failed');await alert.accept();
 await expect(page.getByRole('button',{name:'Save changes',exact:true})).toBeEnabled();
 await expect(page.getByPlaceholder('Business / Restaurant name')).toHaveValue('Unsaved name');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.locator('body')).toContainText('Critical Cafe');
 await page.getByRole('button',{name:/Update status/}).click();
 const statusDialog=page.waitForEvent('dialog');await page.getByRole('button',{name:'Hot',exact:true}).last().click();const failure=await statusDialog;expect(failure.message()).toContain('Save failed');await failure.accept();
 await expect(page.getByText('Moved to Hot',{exact:false})).toHaveCount(0);
});
test('API refuses a queued request after login changes and never sends the other employee token',async({page})=>{
 await boot(page,'salesman');const sent=[];
 await page.route(`${base}/salesman/leads`,route=>{sent.push(route.request().headers().authorization);return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({lead})});});
 const result=await page.evaluate(async()=>{
  const {api}=await import('/src/api.js');
  localStorage.setItem('fieldtrail:session',JSON.stringify({id:'other',role:'salesman',token:'other-token'}));
  try{await api.salesmanCreateLead({clientUuid:'new'},'employee');return 'unexpected success';}catch(e){return {status:e.status,message:e.message};}
 });
 expect(result.status).toBe(401);expect(result.message).toContain('Account changed');expect(sent).toEqual([]);
});
