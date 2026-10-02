import {test,expect} from '@playwright/test';
const base='http://127.0.0.1:9999';
for(const mobile of [false,true])test(`Payments filters, dates and account navigation ${mobile?'mobile':'desktop'}`,async({page})=>{
 if(mobile)await page.setViewportSize({width:390,height:844});
 const requests=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 const accounts=[{key:'unpaid',customer:{name:'Unpaid'},total:100,paid:0,pending:100,overdue:0,currency:'INR'},{key:'partial',customer:{name:'Partial customer'},total:100,paid:25,pending:75,overdue:75,currency:'INR'},{key:'paid',customer:{name:'Paid customer'},total:100,paid:100,pending:0,overdue:0,currency:'INR'}];
 await page.route(`${base}/**`,async route=>{
  const u=new URL(route.request().url());let body={};
  if(u.pathname==='/admin/salesmen')body={salesmen:[]};
  if(u.pathname==='/admin/leads')body={leads:[],total:0};
  if(u.pathname==='/collections'){
   requests.push(Object.fromEntries(u.searchParams));const status=u.searchParams.get('status');
   body={accounts:accounts.filter(a=>status==='all'||status==='pending'&&a.paid===0&&a.pending>0||status==='partial'&&a.paid>0&&a.pending>0||status==='overdue'&&a.overdue>0||status==='paid'&&a.pending===0),summary:{collected:125,pending:175,overdue:75},employees:[],hasMore:false};
  }
  if(u.pathname==='/collections/partial')body={account:{...accounts[1],snapshot:{},version:1},payments:[],historyLimited:false};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.addInitScript(()=>localStorage.setItem('fieldtrail:session',JSON.stringify({id:'test-admin',role:'admin',fullName:'Test Admin',token:'test-token'})));
 await page.goto('/');
 if(mobile)await page.getByRole('button',{name:'More',exact:true}).click();
 await page.getByRole('button',{name:'Payments',exact:true}).click();
 await expect(page.getByRole('combobox',{name:'Period'})).toHaveValue('all');
 await expect(page.locator('.ft-col')).not.toContainText('INR');
 await expect(page.locator('.ft-col')).toContainText('₹');
 await expect(page.locator('.ft-col-account')).toHaveCount(3);
 expect(requests.at(-1).from).toBeUndefined();expect(requests.at(-1).to).toBeUndefined();
 for(const [label,key,count] of [['Pending','pending',1],['Partially paid','partial',1],['Overdue','overdue',1],['Paid','paid',1],['All accounts','all',3]]){
  await page.getByRole('button',{name:label,exact:true}).click();await expect.poll(()=>requests.at(-1).status).toBe(key);await expect(page.locator('.ft-col-account')).toHaveCount(count);
 }
 await page.getByRole('combobox',{name:'Period'}).selectOption('custom');
 await page.getByLabel('Payments received from · IST').fill('2026-01-01');await page.getByLabel('Through · IST').fill('2026-01-31');
 await expect.poll(()=>requests.at(-1).from).toBe('2026-01-01');await expect.poll(()=>requests.at(-1).to).toBe('2026-01-31');
 await expect(page.locator('.ft-col')).toContainText('Outstanding');
 await page.getByLabel('Through · IST').fill('2025-01-01');await expect(page.getByRole('alert')).toContainText('Choose a valid date range');
 await page.getByRole('combobox',{name:'Period'}).selectOption('all');await expect(page.getByRole('alert')).toHaveCount(0);await expect.poll(()=>requests.at(-1).from).toBeUndefined();
 await page.getByRole('button',{name:'Partially paid',exact:true}).click();await page.locator('.ft-col-account').click();
 await expect(page.getByRole('button',{name:'Record payment',exact:true})).toBeVisible();await expect(page.locator('.ft-col-account-summary')).toContainText('₹75.00');await expect(page.locator('.ft-col')).not.toContainText('INR');
 expect(errors).toEqual([]);
});
