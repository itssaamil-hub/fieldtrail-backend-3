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
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+3mS8AAAAASUVORK5CYII=','base64');
 await page.locator('input[type=file]').last().setInputFiles({name:'restaurant.png',mimeType:'image/png',buffer:png});
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
