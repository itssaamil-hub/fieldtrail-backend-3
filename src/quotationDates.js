export function currentISTMonth(now=new Date()) {
 return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit'}).format(now);
}
export function shiftMonth(month,delta) {
 const [year,m]=month.split('-').map(Number),d=new Date(Date.UTC(year,m-1+delta,1));
 return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
}
export function quotationDateRange(mode,month,from,to,now=new Date()) {
 if(mode==='all')return {from:'',to:''};
 if(mode==='custom')return {from,to};
 const selected=mode==='this_month'?currentISTMonth(now):mode==='last_month'?shiftMonth(currentISTMonth(now),-1):month;
 if(!/^\d{4}-\d{2}$/.test(selected))return {from:'',to:''};
 const [y,m]=selected.split('-').map(Number);
 return {from:selected+'-01',to:selected+'-'+new Date(Date.UTC(y,m,0)).getUTCDate()};
}
