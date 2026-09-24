import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BellRing, CalendarClock, CheckCircle2, ChevronRight, CircleDollarSign, Clock3, DatabaseZap, Flame, RefreshCw, Search, ShieldAlert, Target } from 'lucide-react';
import { api } from './api.js';
import './exception-centre.css';

const ACTIVE = new Set(['cold','conversation','hot','demo','negotiation','nurture']);
const money = n => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const DAY = 86400000;
const safeDate = value => { const d = value ? new Date(value) : null; return d && !Number.isNaN(d.getTime()) ? d : null; };
const ageDays = value => { const d = safeDate(value); return d ? Math.max(0, Math.floor((Date.now() - d.getTime()) / DAY)) : 0; };
const pick = (obj, ...keys) => { for (const key of keys) if (obj?.[key] != null) return obj[key]; return null; };

function leadName(l) { return pick(l, 'business', 'businessName', 'business_name') || 'Unnamed lead'; }
function ownerName(l) { return pick(l, 'salesmanName', 'salesman_name') || 'Unassigned'; }
function updatedAt(l) { return pick(l, 'updatedAt', 'updated_at', 'createdAt', 'created_at'); }
function followUp(l) { return pick(l, 'nextFollowUpDate', 'next_follow_up_date'); }
function renewal(l) { return pick(l, 'renewalDate', 'renewal_date'); }
function dealValue(l) { return Number(pick(l, 'dealValue', 'deal_value') || 0); }

function severityRank(value) { return value === 'critical' ? 0 : value === 'high' ? 1 : value === 'medium' ? 2 : 3; }
function labelSeverity(value) { return value === 'critical' ? 'Critical' : value === 'high' ? 'High' : value === 'medium' ? 'Medium' : 'Low'; }

function openSidebar(label) {
  const button = [...document.querySelectorAll('.engage-desktop-sidebar button')].find(b => (b.getAttribute('aria-label') || b.textContent || '').trim() === label);
  button?.click();
}

function openLeadInCrm(item) {
  openSidebar('Leads');
  const target = String(item.entityName || '').trim().toLowerCase();
  if (!target) return;
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    const rows = [...document.querySelectorAll('.ft-row')];
    const row = rows.find(node => (node.textContent || '').toLowerCase().includes(target));
    if (row) { clearInterval(timer); row.click(); }
    if (attempts > 12) clearInterval(timer);
  }, 120);
}

export default function ExceptionCentre() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [leads, setLeads] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [collections, setCollections] = useState([]);
  const [filter, setFilter] = useState('all');
  const [employee, setEmployee] = useState('all');
  const [query, setQuery] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const results = await Promise.allSettled([
      api.adminLeads(),
      api.tasks({ filter: 'all' }),
      api.collections({}),
    ]);
    const leadResult = results[0].status === 'fulfilled' ? results[0].value : null;
    const taskResult = results[1].status === 'fulfilled' ? results[1].value : null;
    const collectionResult = results[2].status === 'fulfilled' ? results[2].value : null;
    if (!leadResult) setError('Lead data could not be loaded. Exception counts may be incomplete.');
    setLeads(leadResult?.leads || []);
    setTasks(taskResult?.tasks || []);
    setCollections(collectionResult?.accounts || collectionResult?.collections || collectionResult?.items || collectionResult?.customers || []);
    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const exceptions = useMemo(() => {
    const now = new Date();
    const rows = [];
    const pushLead = (l, type, severity, title, reason, action = 'Open Lead') => rows.push({
      key: `${type}:${l.id}`, type, severity, title, reason, action, entityType: 'lead', entityId: l.id,
      entityName: leadName(l), owner: ownerName(l), status: l.status, value: dealValue(l), source: l,
    });

    leads.forEach(l => {
      const status = String(l.status || '').toLowerCase();
      const fu = safeDate(followUp(l));
      const age = ageDays(updatedAt(l));
      if (ACTIVE.has(status) && fu && fu < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
        const overdue = Math.max(1, Math.ceil((now - fu) / DAY));
        pushLead(l, 'followup', overdue >= 3 ? 'critical' : 'high', 'Follow-up overdue', `${overdue} day${overdue === 1 ? '' : 's'} overdue · next action was ${fu.toLocaleDateString('en-IN', { day:'numeric', month:'short' })}`);
      }
      if (status === 'hot' && age >= 3) pushLead(l, 'hot', age >= 5 ? 'critical' : 'high', 'Hot lead going cold', `No recorded lead update for ${age} days`);
      if (status === 'negotiation' && age >= 2) pushLead(l, 'negotiation', age >= 5 ? 'critical' : 'high', 'Negotiation stalled', `In negotiation with no recorded lead update for ${age} days`);
      if (ACTIVE.has(status) && !pick(l, 'phone', 'contactNumber', 'contact_number')) pushLead(l, 'data', 'medium', 'Contact number missing', 'Sales team cannot reliably follow up without a contact number');
      if (['conversation','hot','demo','negotiation'].includes(status) && !followUp(l)) pushLead(l, 'data', status === 'hot' || status === 'negotiation' ? 'high' : 'medium', 'Next follow-up not set', `${status === 'negotiation' ? 'Negotiation' : status.charAt(0).toUpperCase()+status.slice(1)} lead has no next follow-up date`);
      if (status === 'negotiation' && dealValue(l) <= 0) pushLead(l, 'data', 'medium', 'Deal value missing', 'Negotiation is active but expected deal value is not recorded');
      const ren = safeDate(renewal(l));
      if (ren && ACTIVE.has(status)) {
        const days = Math.ceil((ren - now) / DAY);
        if (days < 0) pushLead(l, 'renewal', 'critical', 'Renewal overdue', `Renewal date passed ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`);
        else if (days <= 7) pushLead(l, 'renewal', days <= 2 ? 'high' : 'medium', 'Renewal approaching', `Renewal due in ${days} day${days === 1 ? '' : 's'}`);
      }
    });

    tasks.forEach(t => {
      const status = String(pick(t, 'status') || '').toLowerCase();
      const due = safeDate(pick(t, 'dueAt', 'due_at', 'dueDate', 'due_date'));
      if (status !== 'completed' && due && due < now) {
        const overdue = Math.max(1, Math.ceil((now - due) / DAY));
        rows.push({ key:`task:${t.id}`, type:'task', severity: overdue >= 3 ? 'high' : 'medium', title:'Task overdue', reason:`${overdue} day${overdue === 1 ? '' : 's'} overdue`, action:'Open Tasks', entityType:'task', entityName:pick(t,'title') || 'Task', owner:pick(t,'salesman_name','assignee_name','assigned_to_name') || 'Team' });
      }
    });

    collections.forEach(c => {
      const outstanding = Number(pick(c, 'pending', 'outstanding', 'outstanding_amount', 'balance', 'balance_due') || 0);
      const overdueAmount = Number(pick(c, 'overdue') || 0);
      const due = safeDate(pick(c, 'dueDate', 'due_date', 'payment_due_date'));
      if (outstanding > 0 && ((due && due < now) || overdueAmount > 0)) {
        const overdue = due ? Math.max(1, Math.ceil((now - due) / DAY)) : 1;
        const customer = c.customer?.name || pick(c,'business_name','customer_name','business','name') || 'Customer';
        rows.push({ key:`payment:${pick(c,'key','id','customer_key','lead_id') || customer}`, type:'payment', severity: overdue >= 7 ? 'critical' : 'high', title:'Payment overdue', reason:`${money(outstanding)} outstanding${due ? ` · ${overdue} day${overdue === 1 ? '' : 's'} overdue` : ''}`, action:'Open Collections', entityType:'payment', entityName:customer, owner:pick(c,'owner_name','salesman_name') || 'Team', value:outstanding });
      }
    });

    return rows.sort((a,b) => severityRank(a.severity) - severityRank(b.severity) || String(a.entityName).localeCompare(String(b.entityName)));
  }, [leads, tasks, collections]);

  const employees = useMemo(() => [...new Set(exceptions.map(x => x.owner).filter(Boolean))].sort(), [exceptions]);
  const visible = useMemo(() => exceptions.filter(x => {
    if (filter === 'critical' && !['critical','high'].includes(x.severity)) return false;
    if (filter !== 'all' && filter !== 'critical' && x.type !== filter) return false;
    if (employee !== 'all' && x.owner !== employee) return false;
    const q = query.trim().toLowerCase();
    return !q || `${x.entityName} ${x.owner} ${x.title} ${x.reason}`.toLowerCase().includes(q);
  }), [exceptions, filter, employee, query]);

  const count = type => exceptions.filter(x => x.type === type).length;
  const urgent = exceptions.filter(x => ['critical','high'].includes(x.severity)).length;
  const critical = exceptions.filter(x => x.severity === 'critical').length;

  const handleAction = item => {
    if (item.entityType === 'lead') return openLeadInCrm(item);
    if (item.entityType === 'task') return openSidebar('Tasks');
    if (item.entityType === 'payment') {
      const menu = document.querySelector('.ft-app-menu-trigger');
      menu?.click();
    }
  };

  const cards = [
    ['followup','Overdue follow-ups',CalendarClock], ['hot','Stale hot leads',Flame],
    ['negotiation','Stuck negotiations',Target], ['payment','Payment overdue',CircleDollarSign],
    ['task','Overdue tasks',Clock3], ['data','Data issues',DatabaseZap],
  ];

  return <main className="exception-centre">
    <div className="exception-hero">
      <div>
        <div className="exception-kicker"><ShieldAlert size={15}/> MANAGER CONTROL</div>
        <h1>Exception Centre</h1>
        <p>Only the things that need your attention. Healthy sales activity stays out of the way.</p>
      </div>
      <div className="exception-hero-actions">
        <div className="exception-health"><span className={critical ? 'is-risk' : 'is-good'}></span>{critical ? `${critical} critical` : 'No critical exceptions'}</div>
        <button onClick={load} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''}/> Refresh</button>
      </div>
    </div>

    {error && <div className="exception-warning"><AlertTriangle size={16}/>{error}</div>}

    <section className="exception-overview">
      <button className={`exception-score ${filter === 'all' ? 'is-selected' : ''}`} onClick={() => setFilter('all')}>
        <div className="exception-score-icon"><BellRing size={20}/></div>
        <div><strong>{loading ? '—' : exceptions.length}</strong><span>Open exceptions</span></div>
        <small>{urgent} need priority attention</small>
      </button>
      {cards.map(([key,label,Icon]) => <button key={key} className={`exception-stat ${filter === key ? 'is-selected' : ''}`} onClick={() => setFilter(filter === key ? 'all' : key)}>
        <Icon size={17}/><div><strong>{loading ? '—' : count(key)}</strong><span>{label}</span></div>
      </button>)}
    </section>

    <section className="exception-queue">
      <div className="exception-queue-head">
        <div><h2>Needs attention</h2><p>Highest-risk issues appear first.</p></div>
        <div className="exception-filters">
          <button className={filter === 'critical' ? 'is-on' : ''} onClick={() => setFilter(filter === 'critical' ? 'all' : 'critical')}><AlertTriangle size={14}/> Priority only</button>
          <select value={employee} onChange={e => setEmployee(e.target.value)} aria-label="Exception employee"><option value="all">All employees</option>{employees.map(name => <option key={name} value={name}>{name}</option>)}</select>
          <label><Search size={14}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search exceptions"/></label>
        </div>
      </div>

      <div className="exception-list">
        {!loading && visible.map(item => <article className="exception-row" key={item.key}>
          <div className={`exception-severity is-${item.severity}`}>{labelSeverity(item.severity)}</div>
          <div className="exception-main">
            <div className="exception-title-line"><strong>{item.entityName}</strong><span>{item.title}</span></div>
            <p>{item.reason}</p>
            <div className="exception-meta"><span>{item.owner}</span>{item.status && <><i>•</i><span>{String(item.status).replace('_',' ')}</span></>}{item.value > 0 && <><i>•</i><span>{money(item.value)}</span></>}</div>
          </div>
          <button className="exception-open" onClick={() => handleAction(item)}>{item.action}<ChevronRight size={15}/></button>
        </article>)}
        {loading && <div className="exception-empty"><RefreshCw className="spin" size={20}/><strong>Checking your CRM…</strong><span>Building the manager attention queue.</span></div>}
        {!loading && !visible.length && <div className="exception-empty"><CheckCircle2 size={24}/><strong>Nothing needs attention here</strong><span>Try another filter, or enjoy the clean queue.</span></div>}
      </div>
    </section>

    <footer className="exception-footer">{lastUpdated ? `Checked ${lastUpdated.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}` : 'Not checked yet'} · Rules are calculated from live CRM data</footer>
  </main>;
}
