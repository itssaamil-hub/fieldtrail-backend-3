import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarClock, ExternalLink, MessageCircle, Phone, UserRound, Wallet, X } from 'lucide-react';
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

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length === 10 ? `91${digits}` : digits;
}

function openFullLead(name) {
  const leadButton = [...document.querySelectorAll('.engage-desktop-sidebar button')].find(button =>
    (button.getAttribute('aria-label') || button.textContent || '').trim() === 'Leads'
  );
  leadButton?.click();
  let attempts = 0;
  const target = String(name || '').trim().toLowerCase();
  const timer = setInterval(() => {
    attempts += 1;
    const row = [...document.querySelectorAll('.ft-row')].find(node =>
      (node.textContent || '').toLowerCase().includes(target)
    );
    if (row) { clearInterval(timer); row.click(); }
    if (attempts > 12) clearInterval(timer);
  }, 120);
}

function LeadDrawer({ request, onClose }) {
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(''); setLead(null);
    api.adminLeads().then(result => {
      if (!alive) return;
      const target = request.name.trim().toLowerCase();
      const found = (result.leads || []).find(item => {
        const name = String(pick(item,'business','businessName','business_name') || '').trim().toLowerCase();
        return name === target;
      }) || (result.leads || []).find(item => {
        const name = String(pick(item,'business','businessName','business_name') || '').trim().toLowerCase();
        return name.includes(target) || target.includes(name);
      });
      if (!found) setError('Lead could not be found in the current CRM list.');
      else setLead(found);
    }).catch(err => alive && setError(err.message || 'Could not load lead.')).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [request]);

  const phone = useMemo(() => normalizePhone(pick(lead,'phone','contactNumber','contact_number')), [lead]);
  const status = String(pick(lead,'status') || '—').replaceAll('_',' ');
  const owner = pick(lead,'salesmanName','salesman_name') || 'Unassigned';
  const business = pick(lead,'business','businessName','business_name') || request.name;
  const contact = pick(lead,'owner','contactName','contact_name') || '—';
  const followUp = pick(lead,'nextFollowUpDate','next_follow_up_date');
  const renewal = pick(lead,'renewalDate','renewal_date');
  const value = pick(lead,'dealValue','deal_value');
  const pos = pick(lead,'posName','current_pos','pos_name') || '—';
  const notes = pick(lead,'notes','comments','comment') || '';

  return createPortal(
    <div className="exception-lead-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="exception-lead-drawer" role="dialog" aria-modal="true" aria-label="Lead details">
        <header>
          <div><small>EXCEPTION LEAD</small><h2>{business}</h2><p>{request.title}</p></div>
          <button type="button" aria-label="Close lead drawer" onClick={onClose}><X size={18}/></button>
        </header>

        {loading && <div className="exception-lead-state">Loading lead details…</div>}
        {error && <div className="exception-lead-state is-error">{error}</div>}
        {lead && <>
          <div className="exception-lead-topline"><span className="exception-lead-status">{status}</span><span>{owner}</span></div>

          <section className="exception-lead-grid">
            <div><UserRound size={15}/><span>Contact</span><strong>{contact}</strong></div>
            <div><Phone size={15}/><span>Phone</span><strong>{pick(lead,'phone','contactNumber','contact_number') || '—'}</strong></div>
            <div><CalendarClock size={15}/><span>Next follow-up</span><strong>{dateText(followUp)}</strong></div>
            <div><CalendarClock size={15}/><span>Renewal</span><strong>{dateText(renewal)}</strong></div>
            <div><Wallet size={15}/><span>Deal value</span><strong>{money(value)}</strong></div>
            <div><span className="exception-lead-pos-icon">POS</span><span>Current POS</span><strong>{pos}</strong></div>
          </section>

          {notes && <section className="exception-lead-notes"><span>Latest note</span><p>{notes}</p></section>}

          <section className="exception-lead-reason"><span>Why it is flagged</span><strong>{request.reason}</strong></section>

          <div className="exception-lead-actions">
            {phone && <a href={`tel:+${phone}`}><Phone size={15}/> Call</a>}
            {phone && <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer"><MessageCircle size={15}/> WhatsApp</a>}
            <button type="button" onClick={() => openFullLead(business)}><ExternalLink size={15}/> Full lead page</button>
          </div>
        </>}
      </aside>
    </div>,
    document.body
  );
}

export default function ExceptionLeadDrawerBridge() {
  const [request, setRequest] = useState(null);

  useEffect(() => {
    const handle = event => {
      const button = event.target.closest?.('.exception-centre .exception-open');
      if (!button) return;
      const row = button.closest('.exception-row');
      if (!row) return;
      const title = row.querySelector('.exception-title-line span')?.textContent?.trim() || '';
      if (!LEAD_EXCEPTION_TITLES.has(title)) return;
      const name = row.querySelector('.exception-title-line strong')?.textContent?.trim() || '';
      const reason = row.querySelector('.exception-main > p')?.textContent?.trim() || '';
      if (!name) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      setRequest({ name, title, reason, openedAt: Date.now() });
    };
    document.addEventListener('click', handle, true);
    return () => document.removeEventListener('click', handle, true);
  }, []);

  return request ? <LeadDrawer request={request} onClose={() => setRequest(null)} /> : null;
}

const bridgeHost = document.createElement('div');
bridgeHost.id = 'exception-lead-drawer-root';
document.body.appendChild(bridgeHost);
import('react-dom/client').then(({ createRoot }) => createRoot(bridgeHost).render(<ExceptionLeadDrawerBridge />));
