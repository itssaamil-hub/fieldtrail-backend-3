import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarClock, Clock3, MapPin, MessageCircle, Phone, UserRound, Wallet, X } from 'lucide-react';
import { api } from './api.js';
import './exception-lead-drawer.css';

const LEAD_EXCEPTION_TITLES = new Set([
  'Follow-up overdue',
  'Hot lead going cold',
  'Negotiation stalled',
  'Contact number missing',
  'Next follow-up not set',
  'Deal value missing',
  'Renewal overdue',
  'Renewal approaching',
]);

const pick = (obj, ...keys) => {
  for (const key of keys) if (obj?.[key] != null) return obj[key];
  return null;
};

const money = value => value == null || value === '' ? '—' : `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const dateText = value => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
};
const dateTimeText = value => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
};

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length === 10 ? `91${digits}` : digits;
}

export default function ExceptionLeadDrawer({ request, onClose }) {
  const [lead, setLead] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(''); setLead(null); setHistory([]);
    api.adminLeads().then(async result => {
      if (!alive) return;
      const target = request.name.trim().toLowerCase();
      const list = result.leads || [];
      const found = list.find(item => {
        const name = String(pick(item,'business','businessName','business_name') || '').trim().toLowerCase();
        return name === target;
      }) || list.find(item => {
        const name = String(pick(item,'business','businessName','business_name') || '').trim().toLowerCase();
        return name.includes(target) || target.includes(name);
      });
      if (!found) {
        setError('Lead could not be found in the current CRM list.');
        return;
      }
      setLead(found);
      try {
        const result = await api.adminLeadHistory(found.id);
        if (alive) setHistory(result.history || []);
      } catch {
        if (alive) setHistory([]);
      }
    }).catch(err => alive && setError(err.message || 'Could not load lead.')).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [request]);

  useEffect(() => {
    const key = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [onClose]);

  const phone = useMemo(() => normalizePhone(pick(lead,'phone','contactNumber','contact_number')), [lead]);
  const status = String(pick(lead,'status') || '—').replaceAll('_',' ');
  const owner = pick(lead,'salesmanName','salesman_name') || 'Unassigned';
  const business = pick(lead,'business','businessName','business_name') || request.name;
  const contact = pick(lead,'owner','contactName','contact_name') || '—';
  const followUp = pick(lead,'nextFollowUpDate','next_follow_up_date');
  const renewal = pick(lead,'renewalDate','renewal_date');
  const renewalMonth = pick(lead,'renewalMonth','renewal_month');
  const value = pick(lead,'dealValue','deal_value');
  const pos = pick(lead,'posName','current_pos','pos_name') || '—';
  const notes = pick(lead,'notes','comments','comment') || '';
  const subLocation = pick(lead,'subLocation','sub_location') || '—';
  const address = pick(lead,'address') || '—';
  const created = pick(lead,'createdAt','created_at');

  return createPortal(
    <div className="exception-lead-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="exception-lead-drawer exception-lead-drawer-full" role="dialog" aria-modal="true" aria-label="Full lead details">
        <header>
          <div><small>LEAD DETAILS</small><h2>{business}</h2><p>{request.title} · opened from Exception Centre</p></div>
          <button type="button" aria-label="Close lead drawer" onClick={onClose}><X size={18}/></button>
        </header>

        {loading && <div className="exception-lead-state">Loading full lead details…</div>}
        {error && <div className="exception-lead-state is-error">{error}</div>}
        {lead && <>
          <div className="exception-lead-topline"><span className="exception-lead-status">{status}</span><span>{owner}</span></div>

          <section className="exception-lead-grid">
            <div><UserRound size={15}/><span>Contact</span><strong>{contact}</strong></div>
            <div><Phone size={15}/><span>Phone</span><strong>{pick(lead,'phone','contactNumber','contact_number') || '—'}</strong></div>
            <div><CalendarClock size={15}/><span>Next follow-up</span><strong>{dateText(followUp)}</strong></div>
            <div><CalendarClock size={15}/><span>Renewal</span><strong>{renewal ? dateText(renewal) : (renewalMonth || '—')}</strong></div>
            <div><Wallet size={15}/><span>Deal value</span><strong>{money(value)}</strong></div>
            <div><span className="exception-lead-pos-icon">POS</span><span>Current POS</span><strong>{pos}</strong></div>
            <div><MapPin size={15}/><span>Sub location</span><strong>{subLocation}</strong></div>
            <div><Clock3 size={15}/><span>Lead added</span><strong>{dateText(created)}</strong></div>
          </section>

          <section className="exception-lead-details-block">
            <div><span>Address</span><strong>{address}</strong></div>
            <div><span>Salesman</span><strong>{owner}</strong></div>
            <div><span>Status</span><strong className="exception-capitalize">{status}</strong></div>
          </section>

          {notes && <section className="exception-lead-notes"><span>Latest note</span><p>{notes}</p></section>}

          <section className="exception-lead-reason"><span>Why it is flagged</span><strong>{request.reason}</strong></section>

          <section className="exception-lead-history">
            <div className="exception-lead-section-title"><span>Lead timeline</span><small>{history.length ? `${history.length} status change${history.length === 1 ? '' : 's'}` : 'No status history yet'}</small></div>
            {history.length > 0 && <div className="exception-lead-history-list">
              {[...history].reverse().slice(0,12).map((entry,index) => <div key={entry.id || `${entry.changed_at}-${index}`}>
                <i></i>
                <div><strong>{String(entry.new_status || 'updated').replaceAll('_',' ')}</strong><span>{dateTimeText(entry.changed_at)}</span>{entry.old_status && <small>from {String(entry.old_status).replaceAll('_',' ')}</small>}</div>
              </div>)}
            </div>}
          </section>

          <div className="exception-lead-actions">
            {phone && <a href={`tel:+${phone}`}><Phone size={15}/> Call</a>}
            {phone && <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer"><MessageCircle size={15}/> WhatsApp</a>}
            <button type="button" className="exception-lead-close-action" onClick={onClose}>Close lead</button>
          </div>
        </>}
      </aside>
    </div>,
    document.body
  );
}
