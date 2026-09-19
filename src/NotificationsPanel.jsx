import { QuotationAlerts } from "./Quotations.jsx";
import { TaskNotifications } from "./Tasks.jsx";
import React, { useEffect, useRef, useState } from 'react';
import { Bell, Sun, X, RefreshCw } from 'lucide-react';
import { api } from './api.js';
import './notifications.css';
import ActivityFeed from './ActivityFeed.jsx';

export default function NotificationsPanel({ session, online, onClose, onOpenLead, onOpenQuote }) {
  const [view, setView] = useState('brief');
  const [employees, setEmployees] = useState([]);
  const [selected, setSelected] = useState('');
  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [followUpFilter, setFollowUpFilter] = useState('today');
  const [employeeError, setEmployeeError] = useState('');
  const [employeesLoaded, setEmployeesLoaded] = useState(false);
  const dialog = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  const admin = session.role === 'admin';

  useEffect(() => {
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector('button')?.focus();
    const onKey = event => {
      if (event.key === 'Escape') close.current();
      if (event.key !== 'Tab') return;
      const items = [...dialog.current.querySelectorAll('button:not(:disabled),a[href],select:not(:disabled)')].filter(el => el.getClientRects().length);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, []);

  useEffect(() => {
    if (!admin || view !== 'brief') return;
    let cancelled = false;
    setEmployeeError('');
    api.adminSalesmen().then(res => {
      if (cancelled) return;
      const active = (res.salesmen || []).filter(s => s.is_active);
      setEmployees(active);
      setSelected(current => active.some(s => s.id === current) ? current : active[0]?.id || '');
      setEmployeesLoaded(true);
    }).catch(err => { if (!cancelled) { setEmployeeError(err.message); setEmployeesLoaded(true); } });
    return () => { cancelled = true; };
  }, [admin, retry, online, view]);

  useEffect(() => {
    if (admin && view !== 'brief') return;
    if (admin && !selected) { setLoading(!employeesLoaded); return; }
    let cancelled = false;
    setLoading(true); setError(''); setBriefing(null); setExpanded(false); setFollowUpFilter('today');
    if (!online) { setLoading(false); setError('You’re offline. Connect to load your latest briefing.'); return; }
    api.salesBriefing(admin ? selected : undefined).then(res => {
      if (cancelled) return;
      if (!res?.briefing) throw new Error('The server returned an empty briefing.');
      setBriefing(res.briefing);
      if (!admin && res.briefing.notificationDay) {
        api.notificationsMarkRead({ kind: 'briefing', day: res.briefing.notificationDay })
          .then(() => { if (!cancelled) window.dispatchEvent(new Event('fieldtrail:notifications-read')); })
          .catch(() => { /* A failed read receipt must not hide the briefing. */ });
      }
    }).catch(err => {
      if (!cancelled) setError(err.status === 404 ? 'Briefing unavailable. Check that the updated backend is deployed and this employee is active.' : err.status === 401 ? 'Your session has expired. Sign in again to view the briefing.' : err.message || 'Could not load the briefing. Please retry.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [admin, selected, retry, online, employeesLoaded, view]);

  return <div className="ft-notifications-backdrop" onClick={onClose}>
    <section className="ft-notifications" role="dialog" aria-modal="true" aria-labelledby="ft-notifications-title" ref={dialog} onClick={e => e.stopPropagation()}>
      <header className="ft-notifications-header"><h2 id="ft-notifications-title"><Bell size={19} /> Notifications</h2><div className="ft-notifications-header-actions">
        {admin && <button type="button" className="ft-notifications-slider" role="switch" aria-label="Show activity instead of briefing" aria-checked={view === 'activity'} aria-controls="ft-notifications-content" onClick={() => setView(current => current === 'brief' ? 'activity' : 'brief')}>
          <span className="ft-notifications-slider-thumb" aria-hidden="true" /><span>Brief</span><span>Activity</span>
        </button>}
        <button type="button" aria-label="Close notifications" className="ft-notifications-icon" onClick={onClose}><X size={20} /></button></div></header>
      <div id="ft-notifications-content">
      {onOpenQuote && <QuotationAlerts key={retry} onOpen={onOpenQuote} />}
      {!admin && <TaskNotifications />}
      {admin && view === 'activity' ? <ActivityFeed online={online} /> : <>
      {admin && <label className="ft-notifications-select">Employee briefing<select value={selected} onChange={e => setSelected(e.target.value)} disabled={!employees.length}><option value="" disabled>Select an employee</option>{employees.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></label>}
      <div className="ft-notifications-caption"><span><Sun size={17} /> Daily sales briefing</span><button type="button" className="ft-notifications-icon" onClick={() => setRetry(r => r + 1)} aria-label="Refresh briefing" disabled={loading}><RefreshCw size={16} /></button></div>
      {loading && <p role="status">Preparing your briefing…</p>}
      {(employeeError || error) && <div className="ft-notifications-error" role="alert"><p>{employeeError || error}</p><button type="button" onClick={() => setRetry(r => r + 1)}>Retry</button></div>}
      {admin && employeesLoaded && !employees.length && !employeeError && <p>No active employees to show yet.</p>}
      {briefing && <article className="ft-briefing-story">
        <div className="ft-notifications-date">{briefing.date} · {briefing.timeZone} · Latest CRM data</div>
        <h3>{briefing.greeting || `Hello, ${session.fullName?.split(' ')[0] || 'there'}!`}</h3>
        {(briefing.paragraphs || [briefing.summary]).map((paragraph, i) => <p key={i}>{paragraph}</p>)}
        {briefing.followUps && (() => {
          const tabs = [
            ['all', 'All', briefing.followUps.all?.length || 0],
            ['today', 'Today', briefing.followUps.today?.length || 0],
            ['overdue', 'Overdue', briefing.followUps.overdue?.length || 0],
            ['upcoming', 'Upcoming', briefing.followUps.upcoming?.length || 0],
          ];
          const items = briefing.followUps[followUpFilter] || [];
          return <div className="ft-followup-brief">
            <div className="ft-followup-tabs" role="tablist" aria-label="Follow-up filter">{tabs.map(([key, label, count]) =>
              <button key={key} type="button" role="tab" aria-selected={followUpFilter === key} className={followUpFilter === key ? `is-active is-${key}` : ''} onClick={() => setFollowUpFilter(key)}><strong>{count}</strong><span>{label}</span></button>
            )}</div>
            <div className="ft-followup-list">
              {items.length ? items.slice(0, 8).map(lead => <button type="button" className="ft-followup-row" key={`${followUpFilter}-${lead.id}`} onClick={() => !admin && onOpenLead?.(lead.id)} disabled={admin}>
                <span><strong>{lead.business_name}</strong><small>{lead.status?.replaceAll('_', ' ') || 'Lead'} · {lead.next_follow_up_date}</small></span><span aria-hidden="true">›</span>
              </button>) : <div className="ft-followup-empty">No {followUpFilter === 'all' ? 'scheduled' : followUpFilter} follow-ups.</div>}
              {items.length > 8 && <div className="ft-followup-more">+{items.length - 8} more</div>}
            </div>
          </div>;
        })()}
        <div className="ft-briefing-focus"><strong>Your focus today</strong><p>{briefing.focus || briefing.recommendation}</p></div>
        {!!briefing.priorityLeads?.length && <>
          <button type="button" className="ft-briefing-action" onClick={() => setExpanded(v => !v)} aria-expanded={expanded} aria-controls="ft-briefing-priorities">{expanded ? 'Hide' : 'View'} {briefing.priorityLeads.length} priority {briefing.priorityLeads.length === 1 ? 'lead' : 'leads'} {expanded ? '↑' : '→'}</button>
          <ol id="ft-briefing-priorities" hidden={!expanded}>{briefing.priorityLeads.map(lead => <li key={lead.id}><div><strong>{lead.business_name}</strong><div className="ft-notifications-date">{lead.reasons.join(' · ')}</div>{admin && lead.phone && <a href={`tel:${lead.phone}`}>{lead.phone}</a>}</div>{!admin && <button type="button" onClick={() => onOpenLead(lead.id)}>View lead</button>}</li>)}</ol>
        </>}
      </article>}
      </>}
      </div>
    </section>
  </div>;
}
