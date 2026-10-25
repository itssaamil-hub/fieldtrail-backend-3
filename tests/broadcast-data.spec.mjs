import {test,expect} from '@playwright/test';
const report={title:'October won deals',type:'won',currency:'INR',columns:[{key:'business',label:'Business name'},{key:'value',label:'Deal value'}],rows:[{business:'Isolated test customer',value:12000}],offset:0,hasMore:false,from:null,to:null,dateBasis:'First won date',updatedAt:new Date().toISOString()};
async function boot(page){
 await page.addInitScript(()=>localStorage.setItem('fieldtrail:session',JSON.stringify({id:'test-admin',role:'admin',name:'Test admin',token:'test-token'})));
 let links=[];
 await page.route('http://127.0.0.1:9999/**',async route=>{const p=new URL(route.request().url()).pathname,m=route.request().method();let body={};
 if(p==='/admin/salesmen')body={salesmen:[]};else if(p.startsWith('/admin/leads'))body={leads:[],total:0};else if(p.includes('/expenses'))body=[];
 else if(p==='/broadcast-data/employees')body={employees:[]};
 else if(p==='/broadcast-data/preview'){const d=route.request().postDataJSON();body=d.type==='combined'?{...report,type:d.tab==='payments'?'payments':'leads',columns:[{key:'business',label:'Business name'},{key:'value',label:'Deal value'}]}:report;}
 else if(p==='/broadcast-data'&&m==='POST'){const data=route.request().postDataJSON();expect(data.pin).toBe('123456');links=[{id:'test-link',config:data,token:'test-token',protected:true,expires_at:null,revoked_at:null}];body={link:links[0]};}
 else if(p.endsWith('/revoke')){links=links.map(l=>({...l,revoked_at:new Date().toISOString()}));body={ok:true};}
 else if(p==='/broadcast-data')body={links,hasMore:false};
 else if(p==='/quotations/alerts')body={alerts:[]};else if(p==='/tasks/notifications')body={notifications:[]};
 await route.fulfill({json:body});});await page.goto('/');
}
for(const width of [1440,390])test('Broadcast Data settings flow at '+width,async({page})=>{
 await page.setViewportSize({width,height:1000});await boot(page);
 if(width<1024){await page.getByRole('button',{name:'More',exact:true}).click();}
 await page.getByRole('button',{name:'Settings',exact:true}).first().click();
 await page.getByRole('button',{name:'Broadcast Data',exact:true}).click();
 await page.getByLabel('Report name').fill('October won deals');await page.getByLabel('Six-digit PIN').fill('123456');
 await page.getByRole('button',{name:'Preview report',exact:true}).click();await expect(page.getByText('Isolated test customer')).toBeVisible();
 await page.getByRole('button',{name:'Create live link',exact:true}).click();await expect(page.getByRole('link',{name:'Share on WhatsApp'})).toHaveAttribute('href',/wa.me/);
 await expect(page.locator('.broadcast-data')).toBeVisible();expect(await page.locator('.broadcast-data').evaluate(e=>e.getBoundingClientRect().right<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Revoke',exact:true}).click();await page.getByRole('button',{name:'Confirm revoke'}).click();await expect(page.getByRole('link',{name:'Share on WhatsApp'})).toHaveCount(0);await expect(page.getByText('Link revoked.',{exact:true})).toBeVisible();
});
test('recipient PIN, refresh, revocation and XSS safe text',async({page})=>{
 let revoked=false,count=0;
 await page.route('https://engage-backend-65xk.onrender.com/public/broadcast/read',async route=>{const b=route.request().postDataJSON();count++;if(revoked)return route.fulfill({status:404,json:{error:'Link revoked'}});if(b.pin!=='123456')return route.fulfill({status:401,json:{error:'Enter the report PIN.'}});return route.fulfill({json:{...report,rows:[{business:'<img src=x onerror=alert(1)>',value:count}]}});});
 await page.goto('/broadcast/index.html#isolated-test-token');await page.getByLabel('Report PIN').fill('123456');await page.getByRole('button',{name:'Open report',exact:true}).click();await expect(page.getByText('<img src=x onerror=alert(1)>')).toBeVisible();await expect(page.locator('#rows img')).toHaveCount(0);
 const before=count;await page.getByRole('button',{name:'Refresh',exact:true}).click();await expect.poll(()=>count).toBeGreaterThan(before);revoked=true;await page.getByRole('button',{name:'Refresh',exact:true}).click();await expect(page.locator('#report')).toBeHidden();await expect(page.locator('#rows')).toBeEmpty();
});

for(const width of [1440,390])test('combined Deal and Payment Broadcast remains responsive at '+width,async({page})=>{
 await page.setViewportSize({width,height:1000});await boot(page);
 if(width<1024)await page.getByRole('button',{name:'More',exact:true}).click();
 await page.getByRole('button',{name:'Settings',exact:true}).first().click();
 await page.getByRole('button',{name:'Broadcast Data',exact:true}).click();
 await page.getByLabel('Data to share').selectOption('combined');
 await page.getByLabel('Report name').fill('All deals and payments');
 await page.getByLabel('Six-digit PIN').fill('123456');
 await expect(page.getByText('Deals tab',{exact:true})).toBeVisible();
 await expect(page.getByText('Payments tab',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Preview report',exact:true}).click();
 await expect(page.getByText('Isolated test customer')).toBeVisible();
 await page.locator('.broadcast-preview-tabs').getByRole('button',{name:'Payments'}).click();
 await expect(page.getByText('Isolated test customer')).toBeVisible();
 await page.getByRole('button',{name:'Create live link',exact:true}).click();
 await expect(page.getByRole('link',{name:'Open report'})).toHaveAttribute('href',/^https:\/\/engage-backend-65xk\.onrender\.com\/public\/broadcast\/view\?mode=combined#/);
 expect(await page.locator('.broadcast-data').evaluate(e=>e.getBoundingClientRect().right<=innerWidth)).toBe(true);
});

for(const width of [1440,390])test('Broadcast-only width and Employee label at '+width,async({page})=>{
 await page.setViewportSize({width,height:920});await boot(page);
 if(width<1024)await page.getByRole('button',{name:'More',exact:true}).click();
 await page.getByRole('button',{name:'Settings',exact:true}).first().click();
 await page.getByRole('button',{name:'Broadcast Data',exact:true}).click();
 const broadcast=page.locator('.broadcast-data');
 await expect(broadcast.getByLabel('Employee',{exact:true})).toBeVisible();
 await expect(broadcast.getByText('Salesman',{exact:true})).toHaveCount(0);
 if(width===1440)expect(await broadcast.evaluate(el=>el.getBoundingClientRect().width)).toBeGreaterThan(1080);
 await page.getByLabel('Report name').fill('Employee payments report');
 await page.getByLabel('Six-digit PIN').fill('123456');
 await page.getByRole('button',{name:'Preview report',exact:true}).click();
 if(width===390)await expect(page.locator('.broadcast-mobile-cards')).toBeVisible();
 else await expect(page.locator('.broadcast-table-scroll')).toBeVisible();
});
