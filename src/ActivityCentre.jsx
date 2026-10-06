import React, { useEffect, useRef, useState } from 'react';
import { Activity, ArrowRight, CheckCircle2, ChevronRight, CircleDollarSign, FileText, History, RefreshCw, Search, UserPlus, X } from 'lucide-react';
import { api, mapLeadRow } from './api.js';
import './activity-centre.css';

const dateFormat = new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',year:'numeric'});
const timeFormat = new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit'});
const dayKey = value => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
const today = () => dayKey(new Date());
const money = (amount,currency) => new Intl.NumberFormat('en-IN',{style:'currency',currency,maximumFractionDigits:2}).format(Number(amount));
const label = value => String(value || '').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const initials = name => name.split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase();
const tabs = [['all','All activity'],['sales','Sales'],['payments','Payments'],['team','Team'],['system','System']];
const actions = [['','All actions'],['lead.created','Lead created'],['lead.created_by_admin','Admin created lead'],['lead.status_changed','Lead status changed'],['lead.edited','Lead updated'],['quotation.sent','Quotation sent'],['quotation.accepted','Quotation accepted'],['payment.recorded','Payment recorded'],['payment.corrected','Payment corrected'],['payment.deleted','Payment deleted'],['task.created','Task created'],['task.completed','Task completed'],['attendance.day_start','Started day'],['attendance.day_end','Ended day']];
function eventIcon(a) {
  if(a.action.startsWith('payment.')) return CircleDollarSign;
  if(a.action.startsWith('quotation.')) return FileText;
  if(a.action==='lead.status_changed') return ArrowRight;
  if(a.action==='task.completed') return CheckCircle2;
  if(a.action.startsWith('lead.created')) return UserPlus;
  return Activity;
}
export default function ActivityCentre({onOpenLead,onClose,mobile=false}) {
  const [filters,setFilters] = useState({from:today(),through:today(),employee:'all',category:'all',action:'',search:''});
  const [query,setQuery] = useState('');
  const [offset,setOffset] = useState(0);
  const [refresh,setRefresh] = useState(0);
  const [data,setData] = useState(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [people,setPeople] = useState([]);
  const [peopleError,setPeopleError] = useState('');
  const [selected,setSelected] = useState(null);
  const [opening,setOpening] = useState(false);
  const [openError,setOpenError] = useState('');
  const detailsRef = useRef(null);
  const rowRefs = useRef({});
  const change = (key,value) => {setFilters(f=>({...f,[key]:value}));setOffset(0);setSelected(null);setOpenError('');};
  useEffect(()=>{if(query===filters.search)return;const timer=setTimeout(()=>{setFilters(f=>({...f,search:query}));setOffset(0);setSelected(null);},300);return()=>clearTimeout(timer);},[query,filters.search]);
  useEffect(()=>{
    let alive=true;
    api.adminSalesmen().then(v=>{if(alive){setPeople(v.salesmen||[]);setPeopleError('');}}).catch(()=>{if(alive)setPeopleError('Employee filter could not load. Refresh to retry.');});
    return()=>{alive=false;};
  },[refresh]);
  useEffect(()=>{
    let alive=true;
    setLoading(true);setError('');setSelected(null);setOpenError('');
    if (!filters.from || !filters.through) {setLoading(false);setData(null);setError('Choose both dates to view activity.');return;} 
    api.adminActivityFeed({...filters,offset,limit:30}).then(v=>{if(alive)setData(v);}).catch(e=>{if(alive){setError(e.message||'Could not load activity');setData(null);}}).finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;};
  },[filters,offset,refresh]);
  useEffect(()=>{if(selected)detailsRef.current?.focus();},[selected]);
  const closeDetails=()=>{const id=selected?.id;setSelected(null);rowRefs.current[id]?.focus();};
  const openLead=async()=>{
    setOpening(true);setOpenError('');
    try {const r=await api.adminActivityLead(selected.leadId);onOpenLead(mapLeadRow(r.lead));}
    catch(e){setOpenError(e.message||'Could not open lead');}
    finally{setOpening(false);}
  };
  const summary=!loading&&!error?data?.summary:null;
  const cards=[['Leads added',summary?.leadsAdded,UserPlus,'blue'],['Status changes',summary?.statusChanges,ArrowRight,'purple'],['Quotes sent',summary?.quotesSent,FileText,'green'],['Payments recorded',summary?(summary.payments.length?summary.payments.map(p=>money(p.amount,p.currency)).join(' · '):'No payments'):null,CircleDollarSign,'amber'],['Tasks completed',summary?.tasksCompleted,CheckCircle2,'rose']];
  return <main className="ac-page">
    <header className="ac-heading"><div><h1>Activity Centre</h1><p>See what changed, who changed it, and when.</p></div><button className="ac-button" disabled={loading} onClick={()=>setRefresh(n=>n+1)}><RefreshCw size={15} className={loading?'ac-spin':''}/>Refresh</button></header>
    <div className="ac-summary">{cards.map(([name,value,Icon,tone])=><section className="ac-stat" key={name}><span className={`ac-icon ac-${tone}`}><Icon size={20}/></span><div><span>{name}</span><strong>{value??'—'}</strong></div></section>)}</div>
    <div className="ac-filters">
      <label className="ac-search"><span>Search</span><div><Search size={16}/><input aria-label="Search activity" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Customer, employee or activity" maxLength={120}/></div></label>
      <label><span>Performed by</span><select aria-label="Activity employee" value={filters.employee} onChange={e=>change('employee',e.target.value)}><option value="all">All employees</option>{people.map(p=><option key={p.id} value={p.id}>{p.full_name||p.name}</option>)}</select></label>
      <label><span>Action</span><select aria-label="Activity action" value={filters.action} onChange={e=>change('action',e.target.value)}>{actions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      <label><span>From · IST</span><input type="date" aria-label="Activity from" value={filters.from} onChange={e=>change('from',e.target.value)}/></label>
      <label><span>Through · IST</span><input type="date" aria-label="Activity through" value={filters.through} onChange={e=>change('through',e.target.value)}/></label>
    </div>
    {peopleError&&<p className="ac-error" role="alert">{peopleError}</p>}
    <div className="ac-tabs" role="tablist" aria-label="Activity categories">{tabs.map(([v,l])=><button key={v} role="tab" aria-selected={filters.category===v} onClick={()=>change('category',v)}>{l}</button>)}</div>
    <p className="ac-caption">Totals match all filtered events. Employee filter uses who performed the action. Payment amounts reflect recorded events, not outstanding balances.</p>
    <div className={`ac-content ${selected?'ac-has-details':''}`}>
      <section className="ac-feed" aria-label="Activity feed" aria-busy={loading}>
        <div className="ac-feed-heading"><strong>{loading?'Loading activity…':`${data?.summary?.total??0} recorded events`}</strong><span>Times in IST</span></div>
        {loading?<div className="ac-empty" role="status"><RefreshCw size={23} className="ac-spin"/>Loading activity…</div>:error?<div className="ac-empty ac-error" role="alert"><p>{error}</p><button className="ac-button" onClick={()=>setRefresh(n=>n+1)}>Retry</button></div>:!data?.activities.length?<div className="ac-empty"><History size={28}/><strong>No activity in this selection</strong><span>Try another date range or clear the filters.</span><button className="ac-button" onClick={()=>{setQuery('');setFilters({from:today(),through:today(),employee:'all',category:'all',action:'',search:''});setOffset(0);}}>Reset filters</button></div>:data.activities.map((a,i)=>{
          const Icon=eventIcon(a);const showDay=i===0||dayKey(a.createdAt)!==dayKey(data.activities[i-1].createdAt);
          return <React.Fragment key={a.id}>{showDay&&<h2 className="ac-day">{dayKey(a.createdAt)===today()?'Today · ':''}{dateFormat.format(new Date(a.createdAt))}</h2>}<button ref={el=>{rowRefs.current[a.id]=el;}} className={`ac-row ${selected?.id===a.id?'ac-selected':''}`} onClick={()=>{setSelected(a);setOpenError('');}} aria-pressed={selected?.id===a.id}>
            <span className={`ac-icon ac-${a.category}`}><Icon size={17}/></span><span className="ac-avatar">{initials(a.actorName)}</span><span className="ac-row-text"><strong>{a.actorName} <span>· {a.title}</span></strong><small>{a.recordLabel||label(a.entityType)}{a.from||a.to?` · ${label(a.from)||'Not recorded'} → ${label(a.to)||'Not recorded'}`:''}{a.amount!=null&&a.currency?` · ${money(a.amount,a.currency)}`:''}</small></span><time dateTime={a.createdAt}>{timeFormat.format(new Date(a.createdAt))}</time><ChevronRight size={15}/>
          </button></React.Fragment>;
        })}
        {!loading&&!error&&<footer className="ac-pagination"><button className="ac-button" disabled={!offset} onClick={()=>setOffset(n=>Math.max(0,n-30))}>Previous</button><span>Page {Math.floor(offset/30)+1}</span><button className="ac-button" disabled={!data?.hasMore} onClick={()=>setOffset(n=>n+30)}>Next</button></footer>}
      </section>
      {selected?<aside className="ac-details" ref={detailsRef} tabIndex={-1} aria-label="Selected activity details" onKeyDown={e=>{if(e.key==='Escape')closeDetails();}}><header><h2>Activity details</h2><button className="ac-close" aria-label="Close activity details" onClick={closeDetails}><X size={19}/></button></header><span className={`ac-icon ac-${selected.category}`}><Activity size={22}/></span><h3>{selected.title}</h3><p className="ac-record">{selected.recordLabel||'Record name not available'}</p><dl><dt>Performed by</dt><dd>{selected.actorName}</dd><dt>Date and time</dt><dd>{dateFormat.format(new Date(selected.createdAt))} · {timeFormat.format(new Date(selected.createdAt))} IST</dd><dt>Record type</dt><dd>{label(selected.entityType)||'Activity'}</dd></dl>{(selected.from||selected.to)&&<div className="ac-change"><strong>Recorded change</strong><div><span>{label(selected.from)||'Not recorded'}</span><ArrowRight size={16}/><span>{label(selected.to)||'Not recorded'}</span></div></div>}{selected.amount!=null&&selected.currency&&<div className="ac-change"><strong>Recorded amount</strong><p>{money(selected.amount,selected.currency)}</p></div>}{selected.taskTitle&&<p>{selected.taskTitle}</p>}{openError&&<p className="ac-error" role="alert">{openError}</p>}{selected.leadId&&<button className="ac-primary" disabled={opening} onClick={openLead}>{opening?'Opening…':'Open lead'}<ChevronRight size={16}/></button>}<p className="ac-caption">Only recorded details are shown. Older events may contain fewer details.</p></aside>:<aside className="ac-details ac-detail-placeholder"><History size={30}/><h2>Select an activity</h2><p>Choose an event to see its recorded details.</p></aside>}
    </div>
  </main>;
}
