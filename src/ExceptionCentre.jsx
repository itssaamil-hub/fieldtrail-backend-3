import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, BellRing, CalendarClock, CheckCircle2, ChevronRight, CircleDollarSign,
  Clock3, DatabaseZap, Flame, History, RefreshCw, Search, Settings2, ShieldAlert,
  Target, UserRoundCheck, X, PauseCircle, RotateCcw
} from 'lucide-react';
import { api, getApiBase, getSession } from './api.js';
import './exception-centre.css';
import ExceptionLeadDrawer from './exceptionLeadDrawer.jsx';

const ACTIVE = new Set(['cold','conversation','hot','demo','negotiation','nurture']);
const DAY = 86400000;
const DEFAULT_RULES = {
  followup_enabled:true, hot_enabled:true, hot_stale_days:3, hot_critical_days:5,
  negotiation_enabled:true, negotiation_stale_days:2, negotiation_critical_days:5,
  renewal_enabled:true, renewal_warning_days:7, tasks_enabled:true,
  payments_enabled:true, data_quality_enabled:true,
};
const money = n => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const safeDate = value => { const d = value ? new Date(value) : null; return d && !Number.isNaN(d.getTime()) ? d : null; };
const ageDays = value => { const d = safeDate(value); return d ? Math.max(0, Math.floor((Date.now() - d.getTime()) / DAY)) : 0; };
const pick = (obj, ...keys) => { for (const key of keys) if (obj?.[key] != null) return obj[key]; return null; };
const leadName = l => pick(l,'business','businessName','business_name') || 'Unnamed lead';
const ownerName = l => pick(l,'salesmanName','salesman_name') || 'Unassigned';
const updatedAt = l => pick(l,'updatedAt','updated_at','createdAt','created_at');
const followUp = l => pick(l,'nextFollowUpDate','next_follow_up_date');
const renewal = l => pick(l,'renewalDate','renewal_date');
const dealValue = l => Number(pick(l,'dealValue','deal_value') || 0);
const rank = value => value === 'critical' ? 0 : value === 'high' ? 1 : value === 'medium' ? 2 : 3;
const severityLabel = value => value === 'critical' ? 'Critical' : value === 'high' ? 'High' : value === 'medium' ? 'Medium' : 'Low';
const slug = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,60);

async function exceptionRequest(path, options = {}) {
  const token = getSession()?.token || '';
  const response = await fetch(`${getApiBase()}${path}`, {
    method: options.method || 'GET',
    headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  let data = null; try { data = await response.json(); } catch { /* no body */ }
  if (!response.ok) throw new Error(data?.error || `Request failed (${response.status})`);
  return data;
}

function buildDetections(leads, tasks, collections, rules) {
  const now = new Date();
  const rows = [];
  const add = item => rows.push({
    ...item,
    fingerprint:`${item.type}:${item.entityType}:${item.entityId || item.entityName}:${slug(item.title)}`,
    metadata:{ status:item.status || null, value:item.value || 0, action:item.action || null },
  });
  const addLead = (l,type,severity,title,reason,action='Open Lead') => add({
    type,severity,title,reason,action,entityType:'lead',entityId:l.id,entityName:leadName(l),
    owner:ownerName(l),status:l.status,value:dealValue(l),
  });

  leads.forEach(l => {
    const status = String(l.status || '').toLowerCase();
    const age = ageDays(updatedAt(l));
    const fu = safeDate(followUp(l));
    if (rules.followup_enabled && ACTIVE.has(status) && fu && fu < new Date(now.getFullYear(),now.getMonth(),now.getDate())) {
      const days = Math.max(1,Math.ceil((now-fu)/DAY));
      addLead(l,'followup',days >= 3 ? 'critical':'high','Follow-up overdue',`${days} day${days===1?'':'s'} overdue · scheduled ${fu.toLocaleDateString('en-IN',{day:'numeric',month:'short'})}`);
    }
    if (rules.hot_enabled && status === 'hot' && age >= Number(rules.hot_stale_days)) {
      addLead(l,'hot',age >= Number(rules.hot_critical_days) ? 'critical':'high','Hot lead going cold',`No recorded lead update for ${age} days`);
    }
    if (rules.negotiation_enabled && status === 'negotiation' && age >= Number(rules.negotiation_stale_days)) {
      addLead(l,'negotiation',age >= Number(rules.negotiation_critical_days) ? 'critical':'high','Negotiation stalled',`No recorded lead update for ${age} days`);
    }
    if (rules.data_quality_enabled) {
      if (ACTIVE.has(status) && !pick(l,'phone','contactNumber','contact_number')) addLead(l,'data','medium','Contact number missing','Sales team cannot reliably follow up without a contact number');
      if (['conversation','hot','demo','negotiation'].includes(status) && !followUp(l)) addLead(l,'data',['hot','negotiation'].includes(status)?'high':'medium','Next follow-up not set',`${status.charAt(0).toUpperCase()+status.slice(1)} lead has no next follow-up date`);
      if (status === 'negotiation' && dealValue(l) <= 0) addLead(l,'data','medium','Deal value missing','Negotiation is active but expected deal value is not recorded');
    }
    if (rules.renewal_enabled) {
      const ren = safeDate(renewal(l));
      if (ren && ACTIVE.has(status)) {
        const days = Math.ceil((ren-now)/DAY);
        if (days < 0) addLead(l,'renewal','critical','Renewal overdue',`Renewal date passed ${Math.abs(days)} day${Math.abs(days)===1?'':'s'} ago`);
        else if (days <= Number(rules.renewal_warning_days)) addLead(l,'renewal',days <= 2 ? 'high':'medium','Renewal approaching',`Renewal due in ${days} day${days===1?'':'s'}`);
      }
    }
  });

  if (rules.tasks_enabled) tasks.forEach(t => {
    const status = String(pick(t,'status') || '').toLowerCase();
    const due = safeDate(pick(t,'dueAt','due_at','dueDate','due_date'));
    if (status !== 'completed' && due && due < now) {
      const days = Math.max(1,Math.ceil((now-due)/DAY));
      add({type:'task',severity:days>=3?'high':'medium',title:'Task overdue',reason:`${days} day${days===1?'':'s'} overdue`,action:'Open Tasks',entityType:'task',entityId:t.id,entityName:pick(t,'title')||'Task',owner:pick(t,'salesman_name','assignee_name','assigned_to_name')||'Team'});
    }
  });

  if (rules.payments_enabled) collections.forEach(c => {
    const outstanding = Number(pick(c,'pending','outstanding','outstanding_amount','balance','balance_due') || 0);
    const due = safeDate(pick(c,'dueDate','due_date','payment_due_date'));
    if (outstanding > 0 && due && due < now) {
      const days = Math.max(1,Math.ceil((now-due)/DAY));
      add({type:'payment',severity:days>=7?'critical':'high',title:'Payment overdue',reason:`${money(outstanding)} outstanding · ${days} day${days===1?'':'s'} overdue`,action:'Open Collections',entityType:'payment',entityId:pick(c,'key','id','customer_key','lead_id')||leadName(c),entityName:pick(c,'customer.name','business_name','customer_name','business','name')||c.customer?.name||'Customer',owner:pick(c,'salesman_name','owner_name')||'Team',value:outstanding});
    }
  });
  return rows;
}

export default function ExceptionCentre({ onNavigate }) {
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [cases,setCases] = useState([]);
  const [salesmen,setSalesmen] = useState([]);
  const [rules,setRules] = useState(DEFAULT_RULES);
  const [filter,setFilter] = useState('all');
  const [workflow,setWorkflow] = useState('open');
  const [employee,setEmployee] = useState('all');
  const [query,setQuery] = useState('');
  const [showRules,setShowRules] = useState(false);
  const [historyCase,setHistoryCase] = useState(null);
  const [history,setHistory] = useState([]);
  const [lastUpdated,setLastUpdated] = useState(null);
  const [leadRequest,setLeadRequest] = useState(null);
  const [toast,setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [ruleResult, salesmanResult] = await Promise.allSettled([exceptionRequest('/exceptions/settings'),api.adminSalesmen()]);
      const nextRules = ruleResult.status === 'fulfilled' ? {...DEFAULT_RULES,...ruleResult.value.settings} : DEFAULT_RULES;
      setRules(nextRules);
      if (salesmanResult.status === 'fulfilled') setSalesmen(salesmanResult.value.salesmen || []);
      const source = await Promise.allSettled([api.adminLeads(),api.tasks({filter:'all'}),api.collections({status:'all'})]);
      const leads = source[0].status === 'fulfilled' ? source[0].value.leads || [] : null;
      const tasks = source[1].status === 'fulfilled' ? source[1].value.tasks || [] : null;
      const collections = source[2].status === 'fulfilled' ? source[2].value.accounts || [] : null;
      if (!leads) throw new Error('Lead data could not be loaded. Exception Centre was not refreshed.');
      const detections = buildDetections(leads,tasks || [],collections || [],nextRules);
      if (tasks && collections) await exceptionRequest('/exceptions/sync',{method:'POST',body:{exceptions:detections}});
      else setError('Some supporting data could not be loaded. Existing workflow state is shown, but live sync was skipped.');
      try {
        const persisted = await exceptionRequest('/exceptions');
        setCases(persisted.exceptions || []);
      } catch {
        // Safe first-deploy fallback while the backend is still rolling out.
        setCases(detections.map((x,i)=>({id:`live-${i}`,...x,entity_type:x.entityType,entity_id:x.entityId,entity_name:x.entityName,owner_name:x.owner,status:'open',active:true,metadata:x.metadata})));
      }
      setLastUpdated(new Date());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  },[]);

  useEffect(()=>{ load(); },[load]);

  const activeCases = useMemo(()=>cases.filter(c=>{
    if (workflow === 'open') return c.status === 'open' && c.active !== false;
    if (workflow === 'snoozed') return c.status === 'snoozed';
    return c.status === 'resolved';
  }),[cases,workflow]);
  const owners = useMemo(()=>[...new Set(activeCases.map(c=>c.owner_name || c.owner).filter(Boolean))].sort(),[activeCases]);
  const visible = useMemo(()=>activeCases.filter(c=>{
    if (filter === 'priority' && !['critical','high'].includes(c.severity)) return false;
    if (filter !== 'all' && filter !== 'priority' && c.type !== filter) return false;
    const owner = c.owner_name || c.owner || 'Unassigned';
    if (employee !== 'all' && owner !== employee) return false;
    const q = query.trim().toLowerCase();
    return !q || `${c.entity_name||c.entityName} ${owner} ${c.title} ${c.reason}`.toLowerCase().includes(q);
  }).sort((a,b)=>rank(a.severity)-rank(b.severity)),[activeCases,filter,employee,query]);

  const count = type => activeCases.filter(c=>c.type===type).length;
  const urgent = activeCases.filter(c=>['critical','high'].includes(c.severity)).length;
  const critical = activeCases.filter(c=>c.severity==='critical').length;
  const cards = [['followup','Overdue follow-ups',CalendarClock],['hot','Stale hot leads',Flame],['negotiation','Stuck negotiations',Target],['payment','Payment overdue',CircleDollarSign],['task','Overdue tasks',Clock3],['data','Data issues',DatabaseZap]];

  const mutate = async (item, body) => {
    if (String(item.id).startsWith('live-')) return setError('Backend V2 is still deploying. Refresh after Render finishes.');
    setBusy(true); setError('');
    try { await exceptionRequest(`/exceptions/${item.id}`,{method:'PATCH',body}); await load(); }
    catch(e){ setError(e.message); }
    finally { setBusy(false); }
  };
  const snooze = async (item,days) => { await mutate(item,{action:'snooze',until:new Date(Date.now()+days*DAY).toISOString()}); setToast(`Snoozed for ${days} day${days===1?'':'s'}`); setTimeout(()=>setToast(''),2200); };
  const resolve = item => {
    const note = window.prompt('Resolution note (optional):','');
    if (note === null) return;
    mutate(item,{action:'resolve',note});
  };
  const openHistory = async item => {
    setHistoryCase(item); setHistory([]);
    if (String(item.id).startsWith('live-')) return;
    try { const r=await exceptionRequest(`/exceptions/${item.id}/history`); setHistory(r.events||[]); } catch(e){ setError(e.message); }
  };
  const saveRules = async next => {
    setBusy(true); setError('');
    try { const r=await exceptionRequest('/exceptions/settings',{method:'PUT',body:next}); setRules({...DEFAULT_RULES,...r.settings}); setShowRules(false); await load(); }
    catch(e){setError(e.message);} finally{setBusy(false);}
  };
  const primaryAction = item => {
    const type = item.entity_type || item.entityType;
    if (type === 'lead') {
      setLeadRequest({ name:item.entity_name || item.entityName, title:item.title, reason:item.reason, openedAt:Date.now() });
      return;
    }
    if (type === 'task') { onNavigate?.('tasks'); return; }
    if (type === 'payment') window.dispatchEvent(new CustomEvent('fieldtrail:open-collections'));
  };

  return <main className="exception-centre">
    {toast&&<div className="exception-ux-toast is-visible" data-tone="success">{toast}</div>}
    {leadRequest&&<ExceptionLeadDrawer request={leadRequest} onClose={()=>setLeadRequest(null)}/>}
    <div className="exception-hero">
      <div><div className="exception-kicker"><ShieldAlert size={15}/> MANAGER CONTROL</div><h1>Exception Centre</h1><p>Detect risk, assign ownership and close the loop — without losing the audit trail.</p></div>
      <div className="exception-hero-actions">
        <div className="exception-health"><span className={critical?'is-risk':'is-good'}></span>{critical?`${critical} critical`:'No critical exceptions'}</div>
        <button onClick={()=>setShowRules(true)}><Settings2 size={15}/> Rules</button>
        <button onClick={load} disabled={loading||busy}><RefreshCw size={15} className={loading?'spin':''}/> Refresh</button>
      </div>
    </div>
    {error&&<div className="exception-warning"><AlertTriangle size={16}/>{error}</div>}

    <div className="exception-workflow-tabs">
      {[['open','Open'],['snoozed','Snoozed'],['resolved','Resolved']].map(([key,label])=><button key={key} className={workflow===key?'is-active':''} onClick={()=>{setWorkflow(key);setFilter('all')}}>{label}<span>{cases.filter(c=>key==='open'?c.status==='open'&&c.active!==false:c.status===key).length}</span></button>)}
    </div>

    <section className="exception-overview">
      <button className={`exception-score ${filter==='all'?'is-selected':''}`} onClick={()=>setFilter('all')}><div className="exception-score-icon"><BellRing size={20}/></div><div><strong>{loading?'—':activeCases.length}</strong><span>{workflow==='open'?'Open exceptions':workflow==='snoozed'?'Snoozed cases':'Resolved cases'}</span></div><small>{urgent} priority items</small></button>
      {cards.map(([key,label,Icon])=><button key={key} className={`exception-stat ${filter===key?'is-selected':''}`} onClick={()=>setFilter(filter===key?'all':key)}><Icon size={17}/><div><strong>{loading?'—':count(key)}</strong><span>{label}</span></div></button>)}
    </section>

    <section className="exception-queue">
      <div className="exception-queue-head">
        <div><h2>{workflow==='open'?'Needs attention':workflow==='snoozed'?'Snoozed queue':'Resolution history'}</h2><p>{workflow==='open'?'Highest-risk issues appear first.':'Every case keeps its manager workflow state.'}</p></div>
        <div className="exception-filters">
          <button className={filter==='priority'?'is-on':''} onClick={()=>setFilter(filter==='priority'?'all':'priority')}><AlertTriangle size={14}/> Priority only</button>
          <select value={employee} onChange={e=>setEmployee(e.target.value)}><option value="all">All employees</option>{owners.map(name=><option key={name}>{name}</option>)}</select>
          <label><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search exceptions"/></label>
        </div>
      </div>
      <div className="exception-list">
        {!loading&&visible.map(item=>{
          const name=item.entity_name||item.entityName; const owner=item.owner_name||item.owner||'Unassigned'; const meta=item.metadata||{};
          return <article className="exception-row exception-row-v2" key={item.id||item.fingerprint}>
            <div className={`exception-severity is-${item.severity}`}>{severityLabel(item.severity)}</div>
            <div className="exception-main"><div className="exception-title-line"><strong>{name}</strong><span>{item.title}</span></div><p>{item.reason}</p><div className="exception-meta"><span>{owner}</span>{meta.status&&<><i>•</i><span>{String(meta.status).replace('_',' ')}</span></>}{Number(meta.value)>0&&<><i>•</i><span>{money(meta.value)}</span></>}{item.assigned_to_name&&<><i>•</i><span>Owned by {item.assigned_to_name}</span></>}</div></div>
            <div className="exception-actions-v2">
              <button title="History" onClick={()=>openHistory(item)}><History size={15}/></button>
              {workflow==='open'&&<>
                <select aria-label="Assign exception" value={item.assigned_to||''} onChange={e=>mutate(item,{action:'assign',assignedTo:e.target.value||null})}><option value="">Assign…</option>{salesmen.map(s=><option key={s.id} value={s.id}>{s.full_name||s.name}</option>)}</select>
                <button className="exception-snooze" title="Snooze for 1 day" onClick={()=>snooze(item,1)}><PauseCircle size={15}/><span className="exception-snooze-label">Snooze</span></button>
                <button className="exception-resolve" onClick={()=>resolve(item)}><CheckCircle2 size={15}/> Resolve</button>
              </>}
              {workflow!=='open'&&<button onClick={()=>mutate(item,{action:'reopen'})}><RotateCcw size={14}/> Reopen</button>}
              <button className="exception-open" onClick={()=>primaryAction(item)}>Open<ChevronRight size={15}/></button>
            </div>
          </article>;
        })}
        {loading&&<div className="exception-empty"><RefreshCw className="spin" size={20}/><strong>Checking your CRM…</strong><span>Building the manager attention queue.</span></div>}
        {!loading&&!visible.length&&<div className="exception-empty"><UserRoundCheck size={24}/><strong>Nothing needs attention here</strong><span>This queue is clear.</span></div>}
      </div>
    </section>
    <footer className="exception-footer">{lastUpdated?`Checked ${lastUpdated.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}`:'Not checked yet'} · Workflow state is stored in the backend</footer>

    {showRules&&<RuleDrawer rules={rules} busy={busy} onClose={()=>setShowRules(false)} onSave={saveRules}/>} 
    {historyCase&&<HistoryDrawer item={historyCase} events={history} onClose={()=>setHistoryCase(null)}/>} 
  </main>;
}

function RuleDrawer({rules,busy,onClose,onSave}) {
  const [draft,setDraft]=useState({...rules});
  const toggle=key=><label className="exception-rule-toggle"><input type="checkbox" checked={!!draft[key]} onChange={e=>setDraft(v=>({...v,[key]:e.target.checked}))}/><span>{draft[key]?'On':'Off'}</span></label>;
  const number=(key,min=1,max=180)=><input type="number" min={min} max={max} value={draft[key]} onChange={e=>setDraft(v=>({...v,[key]:Math.max(min,Math.min(max,Number(e.target.value)||min))}))}/>;
  return <div className="exception-drawer-backdrop"><aside className="exception-drawer"><header><div><small>EXCEPTION RULES</small><h2>Manager thresholds</h2></div><button onClick={onClose}><X size={18}/></button></header><p className="exception-drawer-intro">Tune when Engage should interrupt you. These settings change live detection for the whole admin team.</p>
    <div className="exception-rule"><div><strong>Overdue follow-ups</strong><span>Flag active leads after their next follow-up date passes.</span></div>{toggle('followup_enabled')}</div>
    <div className="exception-rule"><div><strong>Stale Hot leads</strong><span>Warn after {draft.hot_stale_days} days; critical after {draft.hot_critical_days}.</span></div>{toggle('hot_enabled')}<div className="exception-rule-numbers">{number('hot_stale_days')}<span>→</span>{number('hot_critical_days')}</div></div>
    <div className="exception-rule"><div><strong>Stuck Negotiations</strong><span>Warn after {draft.negotiation_stale_days} days; critical after {draft.negotiation_critical_days}.</span></div>{toggle('negotiation_enabled')}<div className="exception-rule-numbers">{number('negotiation_stale_days')}<span>→</span>{number('negotiation_critical_days')}</div></div>
    <div className="exception-rule"><div><strong>Renewal risk</strong><span>Start warning {draft.renewal_warning_days} days before renewal.</span></div>{toggle('renewal_enabled')}<div className="exception-rule-numbers">{number('renewal_warning_days')}</div></div>
    <div className="exception-rule"><div><strong>Overdue tasks</strong><span>Include past-due team tasks.</span></div>{toggle('tasks_enabled')}</div>
    <div className="exception-rule"><div><strong>Overdue payments</strong><span>Include outstanding balances past their due date.</span></div>{toggle('payments_enabled')}</div>
    <div className="exception-rule"><div><strong>Lead data quality</strong><span>Missing phone, follow-up date or negotiation value.</span></div>{toggle('data_quality_enabled')}</div>
    <footer><button onClick={onClose}>Cancel</button><button className="exception-save-rules" disabled={busy} onClick={()=>onSave(draft)}>Save rules</button></footer>
  </aside></div>;
}

function HistoryDrawer({item,events,onClose}) {
  return <div className="exception-drawer-backdrop"><aside className="exception-drawer exception-history-drawer"><header><div><small>CASE HISTORY</small><h2>{item.entity_name||item.entityName}</h2></div><button onClick={onClose}><X size={18}/></button></header><p className="exception-drawer-intro">{item.title} · {item.reason}</p><div className="exception-timeline">{events.length?events.map(e=><div key={e.id}><span></span><section><strong>{String(e.action||'updated').replace('_',' ')}</strong><small>{e.actor_name||'System'} · {new Date(e.created_at).toLocaleString('en-IN')}</small>{e.note&&<p>{e.note}</p>}</section></div>):<div className="exception-empty"><History size={22}/><strong>No workflow actions yet</strong><span>Actions such as resolve, snooze and assign will appear here.</span></div>}</div></aside></div>;
}
