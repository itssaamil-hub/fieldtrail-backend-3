import React, { useState } from 'react';
import './desktop-deals.css';

const STAGES = [
  ['cold', 'Cold', '#94a5b1'], ['conversation', 'Conversation', '#608c91'],
  ['hot', 'Hot', '#ca7760'], ['demo', 'Demo', '#a497b8'],
  ['negotiation', 'Negotiation', '#b79b60'], ['won', 'Won', '#5c9476'],
  ['lost', 'Lost', '#a8acac'], ['nurture', 'Nurture', '#879c65'],
];
const amount = lead => lead.dealValue != null && Number.isFinite(Number(lead.dealValue)) ? Number(lead.dealValue) : null;
const money = value => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
function followUp(value) {
  if (!value) return null;
  const day = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const date = new Date(`${day}T12:00:00+05:30`);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const label = date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' });
  return {
    overdue: day < today,
    today: day === today,
    text: day < today ? `Overdue · ${label}` : day === today ? `Due today · ${label}` : `Follow-up · ${label}`,
  };
}
export default function DesktopDealsBoard({ leads, visibleStatus = 'all', onStatusChange, onSelectLead }) {
  const [dragging, setDragging] = useState(null);
  const [over, setOver] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function drop(status) {
    const lead = leads.find(l => l.id === dragging);
    setDragging(null); setOver(null);
    if (!lead || lead.status === status || saving) return;
    setSaving(true); setError('');
    try { await onStatusChange(lead.id, status); }
    catch (err) { setError(err.message || 'Could not update the deal. Please try again.'); }
    finally { setSaving(false); }
  }
  return <>
    {error && <div className="engage-deals-error" role="alert">{error}</div>}
    <div className="engage-deals-board" aria-label="Deals by status" aria-busy={saving}>
      {STAGES.filter(([status]) => visibleStatus === 'all' || status === visibleStatus).map(([status, label, colour]) => {
        const rows = leads.filter(l => l.status === status);
        const valued = rows.filter(l => amount(l) !== null);
        const totalValue = valued.reduce((total, l) => total + amount(l), 0);
        return <section key={status} className={`engage-deals-column${over === status ? ' is-over' : ''}${rows.length === 0 ? ' is-empty' : ''}`} aria-label={`${label} deals`}
          onDragOver={e => { e.preventDefault(); if (!saving) setOver(status); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(null); }}
          onDrop={e => { e.preventDefault(); drop(status); }}>
          <div className="engage-deals-column-heading" style={{ borderTopColor: colour }}>
            <div><strong>{label}</strong><span>{rows.length}</span></div>
            <small>{rows.length} {rows.length === 1 ? 'lead' : 'leads'} · {valued.length ? money(totalValue) : 'No value'}{valued.length < rows.length && valued.length > 0 ? ` · ${rows.length - valued.length} unpriced` : ''}</small>
          </div>
          <div className="engage-deals-cards">{rows.map(lead => {
            const follow = followUp(lead.nextFollowUpDate);
            const leadAmount = amount(lead);
            return <button key={lead.id} type="button" className="engage-deal-card" draggable={!saving}
              onDragStart={e => { setDragging(lead.id); e.dataTransfer.setData('text/plain', String(lead.id)); e.dataTransfer.effectAllowed = 'move'; }}
              onDragEnd={() => { setDragging(null); setOver(null); }} onClick={() => onSelectLead(lead)}
              style={{ opacity: dragging === lead.id ? 0.4 : 1 }}>
              <strong className="engage-deal-name">{lead.business}</strong>
              <div className={`engage-deal-value${leadAmount === null ? ' is-empty-value' : ''}`}>{leadAmount === null ? 'Value not set' : money(leadAmount)}</div>
              <div className="engage-deal-meta-row">
                <div className="engage-deal-owner"><span aria-hidden="true">{(lead.salesmanName || '?').slice(0, 1)}</span>{lead.salesmanName || 'Unassigned'}</div>
                {follow && !follow.overdue && <div className={`engage-deal-followup${follow.today ? ' is-today' : ''}`}>{follow.text}</div>}
              </div>
              {follow?.overdue && <div className="engage-deal-overdue-pill">{follow.text}</div>}
            </button>;
          })}</div>
          {!rows.length && <div className="engage-deals-empty"><span>Empty stage</span><small>Drop a deal here</small></div>}
        </section>;
      })}
    </div>
    <div className="engage-deals-hint">Drag a deal to change its stage · Click a card to open lead details</div>
  </>;
}
