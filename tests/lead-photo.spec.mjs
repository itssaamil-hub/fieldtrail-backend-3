import {test, expect} from '@playwright/test';

const apiBase='http://127.0.0.1:9999';
const salesmanSession={id:'smoke-salesman',role:'salesman',name:'Smoke Salesman',fullName:'Smoke Salesman',token:'smoke-token'};
const adminSession={id:'smoke-admin',role:'admin',name:'Smoke Admin',fullName:'Smoke Admin',token:'smoke-token'};
const employee={id:'smoke-salesman',full_name:'Smoke Salesman',phone:'9999999999',is_active:true,status:'offline'};

async function boot(page,session) {
 await page.route(`${apiBase}/**`,async route=>{
  const req=route.request(), path=new URL(req.url()).pathname;
  let data={};
  if(path==='/salesman/settings')data={leadSettings:{},locationSettings:{gpsLocation:false,locationMandatoryForNewLead:false},photoSettings:{required:true},employeePermissions:{allowLeadWithoutStartDay:true}};
  else if(path==='/salesman/leads')data={leads:[],total:0};
  else if(path==='/admin/salesmen')data={salesmen:[employee]};
  else if(path==='/admin/leads')data={leads:[],total:0};
  else if(path==='/admin/dashboard/summary')data={};
  else if(path==='/admin/settings')data={leadSettings:{},locationSettings:{gpsLocation:false},messageSettings:{}};
  else if(path.startsWith('/day-closing/permissions'))data={require_closing:false,allow_skip:true,allow_lead_without_start_day:true};
  else if(path==='/admin/reports/performance-targets')data={targets:[]};
  else if(path.startsWith('/admin/employees/')&&path.endsWith('/photo-policy'))data={required:false};
  else if(path.startsWith('/admin/employees/')&&path.endsWith('/location-policy'))data={gpsLocation:false,version:0};
  else if(path.includes('/notifications'))data={notifications:[]};
  else if(path.startsWith('/tasks'))data={tasks:[]};
  else if(path.startsWith('/quotations'))data={quotes:[]};
  else if(path.startsWith('/collections'))data={accounts:[],summary:{}};
  else if(req.method()!=='GET')data={ok:true};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.addInitScript(value=>localStorage.setItem('fieldtrail:session',JSON.stringify(value)),session);
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await page.waitForTimeout(700);
}
test('Salesman Add Lead keeps Category 70% and Photo 30%, with mandatory image gate',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await boot(page,salesmanSession);
 await page.getByRole('button',{name:'Add Deal'}).click();
 const area=page.locator('[data-lead-category-photo="true"]');
 await expect(area).toBeVisible();
 await expect(area.getByText('Category',{exact:true})).toBeVisible();
 await expect(area.getByText('Photo *',{exact:true})).toBeVisible();
 await expect(area.getByRole('button',{name:'Add restaurant photo'})).toBeVisible();
 const columns=await area.evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').map(parseFloat));
 expect(columns[0]/(columns[0]+columns[1])).toBeGreaterThan(.65);
 expect(columns[0]/(columns[0]+columns[1])).toBeLessThan(.75);
 await area.getByRole('button',{name:'Add restaurant photo'}).click();
 await expect(page.getByRole('button',{name:'Gallery'})).toBeVisible();
 const pngBytes=await page.evaluate(async()=>{
   const canvas=document.createElement('canvas');
   canvas.width=320;canvas.height=180;
   const context=canvas.getContext('2d');
   context.fillStyle='#284c42';context.fillRect(0,0,320,180);
   context.fillStyle='#ffffff';context.fillRect(20,20,180,100);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
   return Array.from(new Uint8Array(await blob.arrayBuffer()));
 });
 await page.getByRole('dialog',{name:'Add Lead'}).locator('input[type=file]').last().setInputFiles({name:'restaurant.png',mimeType:'image/png',buffer:Buffer.from(pngBytes)});
 await expect(page.getByText(/Photo ready/)).toBeVisible();
 await expect(area.getByRole('button',{name:'Change restaurant photo'})).toBeVisible();
});
test('Admin can set Photo Required for one employee under Work Rules',async({page})=>{
 await boot(page,adminSession);
 const writes=[];
 await page.route('**/admin/employees/*/photo-policy',async route=>{
  const req=route.request();
  if(req.method()==='PUT'){
   writes.push(req.postDataJSON());
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({required:true})});
  }else await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({required:false})});
 });
 await page.getByRole('button',{name:'Employees'}).click();
 await page.getByRole('button',{name:'Settings'}).last().click();
 await page.getByRole('button',{name:'Work Rules'}).click();
 const photo=page.getByRole('switch',{name:'Photo Required'});
 await expect(photo).not.toBeChecked();
 await photo.check();
 await page.getByRole('button',{name:'Save Photo Setting'}).click();
 await expect(page.getByText('Photo requirement saved.')).toBeVisible();
 expect(writes).toEqual([{required:true}]);
});


test('Salesman Add Deal draft survives closing and refreshing; reset icon left of X clears it',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await boot(page,salesmanSession);
 await page.getByRole('button',{name:'Add Deal'}).click();
 let dialog=page.getByRole('dialog',{name:'Add Lead'});
 await dialog.getByPlaceholder('e.g. Ganga Cafe').fill('Unfinished Café');
 await dialog.getByPlaceholder('e.g. Gomti Nagar').fill('Draft Area');
 await dialog.locator('input[type=date]').first().fill('2026-12-01');
 await dialog.getByRole('button',{name:'Close Add Lead'}).click();

 await page.getByRole('button',{name:'Add Deal'}).click();
 dialog=page.getByRole('dialog',{name:'Add Lead'});
 await expect(dialog.getByPlaceholder('e.g. Ganga Cafe')).toHaveValue('Unfinished Café');
 await expect(dialog.getByPlaceholder('e.g. Gomti Nagar')).toHaveValue('Draft Area');
 await dialog.getByRole('button',{name:'Close Add Lead'}).click();

 await page.reload({waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Add Deal'}).click();
 dialog=page.getByRole('dialog',{name:'Add Lead'});
 await expect(dialog.getByPlaceholder('e.g. Ganga Cafe')).toHaveValue('Unfinished Café');
 await expect(dialog.getByPlaceholder('e.g. Gomti Nagar')).toHaveValue('Draft Area');

 const reset=dialog.getByRole('button',{name:'Reset Add Lead draft'});
 const close=dialog.getByRole('button',{name:'Close Add Lead'});
 await expect(reset).toBeVisible();
 const a=await reset.boundingBox(),b=await close.boundingBox();
 expect(a.x+a.width).toBeLessThanOrEqual(b.x+1);
 await reset.click();
 await expect(dialog.getByPlaceholder('e.g. Ganga Cafe')).toHaveValue('');
 await expect(dialog.getByPlaceholder('e.g. Gomti Nagar')).toHaveValue('');
 await expect(dialog.locator('input[type=date]').first()).toHaveValue('');
 await expect(dialog.locator('button[data-mobile-lead-save="true"]')).toBeDisabled();
 await close.click();

 await page.getByRole('button',{name:'Add Deal'}).click();
 dialog=page.getByRole('dialog',{name:'Add Lead'});
 await expect(dialog.getByPlaceholder('e.g. Ganga Cafe')).toHaveValue('');
 await expect(dialog.getByPlaceholder('e.g. Gomti Nagar')).toHaveValue('');
 const keys=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('engage:salesman-add-lead-draft:v1:')));
 expect(keys).toHaveLength(0);
});

test('Salesman draft retains compressed photo until reset, without uploading it',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await boot(page,salesmanSession);
 await page.getByRole('button',{name:'Add Deal'}).click();
 let dialog=page.getByRole('dialog',{name:'Add Lead'});
 await dialog.getByPlaceholder('e.g. Ganga Cafe').fill('Photo Draft');
 await dialog.getByRole('button',{name:'Add restaurant photo'}).click();
 const pngBytes=await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;
  const c=canvas.getContext('2d');
  c.fillStyle='#29493d';c.fillRect(0,0,320,180);
  c.fillStyle='#ffffff';c.fillRect(15,15,160,90);
  return Array.from(new Uint8Array(await (await new Promise(resolve=>canvas.toBlob(resolve,'image/png'))).arrayBuffer()));
 });
 await dialog.locator('input[type=file]').last().setInputFiles({name:'draft.png',mimeType:'image/png',buffer:Buffer.from(pngBytes)});
 await expect(dialog.getByText(/Photo ready/)).toBeVisible();
 await dialog.getByRole('button',{name:'Close Add Lead'}).click();
 await page.reload({waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Add Deal'}).click();
 dialog=page.getByRole('dialog',{name:'Add Lead'});
 await expect(dialog.getByText(/Photo ready/)).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Change restaurant photo'})).toBeVisible();
 await dialog.getByRole('button',{name:'Reset Add Lead draft'}).click();
 await expect(dialog.getByText(/Photo ready/)).toHaveCount(0);
 await expect(dialog.getByRole('button',{name:'Add restaurant photo'})).toBeVisible();
});


test('mandatory photo missing: Save Lead shows upload warning immediately without spinner or request',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await boot(page,salesmanSession);
 let leadPosts=0;
 await page.route('**/salesman/leads', async route=>{
   if(route.request().method()==='POST')leadPosts++;
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({leads:[],total:0})});
 });
 await page.getByRole('button',{name:'Add Deal'}).click();
 const dialog=page.getByRole('dialog',{name:'Add Lead'});
 await expect(dialog.getByText('Photo *')).toBeVisible();
 await dialog.getByPlaceholder('e.g. Ganga Cafe').fill('Cafe Missing Photo');
 const save=dialog.locator('[data-mobile-lead-save="true"]');
 await expect(save).toBeEnabled();
 await save.click();
 await expect(dialog.getByText('Please upload a restaurant photo.').first()).toBeVisible();
 await expect(dialog.getByText('Photo ready')).toHaveCount(0);
 await expect(save).toHaveText('Save Lead');
 await expect(save).toBeEnabled();
 expect(leadPosts).toBe(0);

 await dialog.getByRole('button',{name:'Add restaurant photo'}).click();
 const pixels=await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#284c42';ctx.fillRect(0,0,320,180);
  ctx.fillStyle='#ffffff';ctx.fillRect(20,20,180,90);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
 });
 await dialog.locator('input[type=file]').last().setInputFiles({name:'restaurant.png',mimeType:'image/png',buffer:Buffer.from(pixels)});
 await expect(dialog.getByText(/Photo ready/)).toBeVisible();
 await expect(dialog.getByText('Please upload a restaurant photo.')).toHaveCount(0);
 expect(leadPosts).toBe(0);
});
