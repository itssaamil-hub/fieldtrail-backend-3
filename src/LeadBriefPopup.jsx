import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X } from 'lucide-react';
import { api, getSession } from './api.js';
import './lead-brief.css';

export default function LeadBriefPopup({ lead, buildBrief, onClose }) {
  const [brief, setBrief] = useState(null);
  const [text, setText] = useState('');
  const [done, setDone] = useState(false);
  const [historyWarning, setHistoryWarning] = useState('');
  const dialog = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Freeze the selected lead for this popup; each open is a new component.
  const snapshot = useRef({ lead, buildBrief });
  useEffect(() => {
    let cancelled = false;
    const selected = snapshot.current.lead;
    const fetchHistory = getSession()?.role === 'admin' ? api.adminLeadHistory : api.salesmanLeadHistory;
    const run = async () => {
      let history = [];
      if (selected.syncStatus !== 'queued') {
        try { history = (await fetchHistory(selected.id)).history || []; }
        catch { if (!cancelled) setHistoryWarning('Status history unavailable. This brief uses the lead details currently loaded.'); }
      }
      if (!cancelled) setBrief(snapshot.current.buildBrief(selected, history));
    };
    run();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!brief) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const words = brief.summary.match(/\S+\s*/g) || [];
    let timer, index = 0, cancelled = false;
    const finish = () => { clearTimeout(timer); if (!cancelled) { setText(brief.summary); setDone(true); } };
    const type = () => {
      if (cancelled) return;
      index += 1;
      setText(words.slice(0, index).join(''));
      if (index < words.length) timer = setTimeout(type, 28);
      else finish();
    };
    if (motion.matches) finish();
    else timer = setTimeout(type, 160);
    const onMotion = () => { if (motion.matches) finish(); };
    motion.addEventListener?.('change', onMotion);
    return () => { cancelled = true; clearTimeout(timer); motion.removeEventListener?.('change', onMotion); };
  }, [brief]);

  useEffect(() => {
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector('button')?.focus();
    const keydown = event => {
      if (event.key === 'Escape') { event.stopPropagation(); closeRef.current(); }
      if (event.key === 'Tab') {
        const buttons = [...dialog.current.querySelectorAll('button')];
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keydown, true);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keydown, true); previous?.focus(); };
  }, []);

  return createPortal(<div className="ft-lead-brief-backdrop" onClick={event => { event.stopPropagation(); onClose(); }}>
    <section className="ft-lead-brief-popup" role="dialog" aria-modal="true" aria-labelledby="ft-lead-brief-title" ref={dialog} onClick={event => event.stopPropagation()}>
      <header><h2 id="ft-lead-brief-title"><Sparkles size={18} /> Lead brief</h2><button type="button" aria-label="Close lead brief" onClick={onClose}><X size={19} /></button></header>
      <div className="ft-lead-brief-business">{lead.business}</div>
      <div className="ft-lead-brief-status" role="status">{done ? 'Ready · Based on your CRM data' : 'Preparing your brief…'}</div>
      {historyWarning && <p className="ft-lead-brief-warning">{historyWarning}</p>}
      <div className="ft-lead-brief-copy" aria-busy={!done}><span>{text}</span>{!done && <span className="ft-lead-brief-cursor" aria-hidden="true" />}</div>
      {done && <section className="ft-lead-brief-next"><h3>Recommended next action</h3><p>{brief.nextAction}</p></section>}
      <button type="button" className="ft-lead-brief-close" onClick={onClose}>Close</button>
    </section>
  </div>, document.body);
}
