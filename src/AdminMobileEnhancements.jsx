import React, { useEffect, useMemo, useState } from 'react';
import { getApiBase, getSession } from './api.js';

const DAY = 86400000;
const istKey = date => new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Kolkata', year:'numeric', month:'2-digit', day:'2-digit' }).format(date);
const dayLabel = date => new Intl.DateTimeFormat('en-GB', { timeZone:'Asia/Kolkata', day:'numeric', month:'short' }).format(date);
const createdAt = lead => lead?.createdAt instanceof Date ? lead.createdAt : new Date(lead?.createdAt || lead?.created_at || 0);

function series(leads, offset) {
  const days = Array.from({ length:7 }, (_, index) => {
    const d = new Date(Date.now() - (offset + 6 - index) * DAY);
    return { key:istKey(d), label:dayLabel(d), value:0 };
  });
  const map = new Map(days.map(d => [d.key,d]));
  leads.forEach(lead => {
    const date = createdAt(lead);
    if (!Number.isNaN(date.getTime())) map.get(istKey(date)) && (map.get(istKey(date)).value += 1);
  });
  return days;
}

export function AdminMobileLeadTrend({ leads = [] }) {
  const current = useMemo(() => series(leads, 0), [leads]);
  const previous = useMemo(() => series(leads, 7), [leads]);
  const currentTotal = current.reduce((n,d)=>n+d.value,0);
  const previousTotal = previous.reduce((n,d)=>n+d.value,0);
  const max = Math.max(4, ...current.map(d=>d.value));
  const width=360, height=122, left=28, right=10, top=8, bottom=28;
  const plotW=width-left-right, plotH=height-top-bottom;
  const x=i=>left+(plotW*i)/6;
  const y=v=>top+plotH-(v/max)*plotH;
  const points=current.map((d,i)=>`${x(i)},${y(d.value)}`).join(' ');
  const pct = previousTotal ? Math.round(((currentTotal-previousTotal)/previousTotal)*100) : null;
  return <section className="engage-mobile-lead-trend">
    <div className="engage-mobile-lead-trend-head">
      <div><div className="engage-mobile-lead-trend-title">Daily Leads Created</div><div className="engage-mobile-lead-trend-sub">Last 7 days · {currentTotal} lead{currentTotal===1?'':'s'}</div></div>
      {pct !== null && <span className={`engage-mobile-lead-trend-badge${pct<0?' is-down':pct===0?' is-flat':''}`}>{pct>0?'↑':pct<0?'↓':'→'} {Math.abs(pct)}%</span>}
      {pct === null && currentTotal > 0 && <span className="engage-mobile-lead-trend-badge">New activity</span>}
    </div>
    <svg className="engage-mobile-lead-trend-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Daily leads created in the last seven days">
      {[0,max/2,max].map(v => <React.Fragment key={v}><line x1={left} x2={left+plotW} y1={y(v)} y2={y(v)} className="engage-mobile-lead-trend-grid"/><text x="2" y={y(v)+4} className="engage-mobile-lead-trend-y">{Math.round(v)}</text></React.Fragment>)}
      <polyline points={points} className="engage-mobile-lead-trend-line" />
      {current.map((d,i)=><React.Fragment key={d.key}><circle cx={x(i)} cy={y(d.value)} r="3.5" className="engage-mobile-lead-trend-dot"><title>{d.label}: {d.value} leads</title></circle><text x={x(i)} y={height-7} textAnchor="middle" className="engage-mobile-lead-trend-x">{d.label}</text></React.Fragment>)}
    </svg>
  </section>;
}

const fmtTime = value => {
  if (!value) return '—';
  const d = new Date(value); if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',hour:'numeric',minute:'2-digit'}).format(d);
};
const relative = value => {
  if (!value) return '—';
  const d=new Date(value); if(Number.isNaN(d.getTime())) return '—';
  const mins=Math.max(0,Math.floor((Date.now()-d)/60000));
  if(mins<1)return 'Just now'; if(mins<60)return `${mins} min ago`; const h=Math.floor(mins/60); if(h<24)return `${h} hr${h===1?'':'s'} ago`; const days=Math.floor(h/24); return `${days} day${days===1?'':'s'} ago`;
};
const initials = name => String(name||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();

export function AdminTeamActivitySheet({ salesmen = [], onClose }) {
  const [briefs,setBriefs]=useState({});
  const [query,setQuery]=useState('');
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    let live=true; const base=getApiBase(), token=getSession()?.token;
    if(!base||!token){setLoading(false);return;}
    const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    Promise.all(salesmen.map(async s=>{try{const r=await fetch(`${base}/admin/salesmen/${encodeURIComponent(s.id)}/brief?date=${day}`,{headers:{Authorization:`Bearer ${token}`}});return [s.id,r.ok?await r.json():null]}catch{return [s.id,null]}})).then(rows=>{if(live){setBriefs(Object.fromEntries(rows));setLoading(false)}});
    return()=>{live=false};
  },[salesmen]);
  useEffect(()=>{const key=e=>e.key==='Escape'&&onClose();document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key)},[onClose]);
  const employees=salesmen.map(s=>{
    const b=briefs[s.id]; const sessions=b?.sessions||[]; const first=sessions[0], last=sessions[sessions.length-1];
    const status=s.status==='online'?'active':sessions.length?(last?.endedAt?'ended':'offline'):'not-started';
    const events=b?.events||[]; const lastEvent=events.reduce((a,e)=>!a||new Date(e.at)>new Date(a)?e.at:a,null);
    return { ...s, brief:b, status, first, last, lastEvent };
  });
  const visible=employees.filter(e=>!query.trim()||String(e.name||'').toLowerCase().includes(query.trim().toLowerCase()));
  const counts=employees.reduce((a,e)=>{a[e.status]=(a[e.status]||0)+1;return a},{})
  return <div className="engage-team-sheet-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <section className="engage-team-sheet" role="dialog" aria-modal="true" aria-label="Team Activity">
      <div className="engage-team-handle" />
      <div className="engage-team-sheet-head"><div><h2>Team Activity</h2><p className="engage-team-summary-text">{employees.length} Employees · {counts.active||0} Active now</p></div><button type="button" className="engage-team-close" aria-label="Close" onClick={onClose}>×</button></div>
      <div className="engage-team-summary-cards"><div data-tone="active"><strong>{counts.active||0}</strong><span>Active now</span></div><div data-tone="ended"><strong>{counts.ended||0}</strong><span>Day ended</span></div><div data-tone="not-started"><strong>{counts['not-started']||0}</strong><span>Not started</span></div><div data-tone="offline"><strong>{counts.offline||0}</strong><span>Offline</span></div></div>
      <div className="engage-team-search-wrap"><span>⌕</span><input type="search" placeholder="Search employee…" value={query} onChange={e=>setQuery(e.target.value)} /></div>
      <div className="engage-team-list">{loading?<div className="engage-team-empty">Loading…</div>:visible.length?visible.map(e=><article key={e.id} className="engage-team-employee-card" data-status={e.status}>
        <div className="engage-team-employee-top"><div className="engage-team-avatar">{initials(e.name)}</div><div className="engage-team-employee-name-wrap"><div className="engage-team-employee-name">{e.name}</div><div className="engage-team-employee-role">{e.area||'Sales Executive'}</div></div><span className="engage-team-status">{e.status==='active'?'Active now':e.status==='ended'?'Day ended':e.status==='offline'?'Offline':'Not started'}</span></div>
        <div className="engage-team-meta-grid"><div className="engage-team-meta"><span>{e.status==='ended'?'Ended day':'Started'}</span><strong>{fmtTime(e.status==='ended'?e.last?.endedAt:e.first?.startedAt)}</strong></div><div className="engage-team-meta"><span>Last location</span><strong>{relative(e.lastUpdate)}</strong></div></div>
        <div className="engage-team-metrics"><div><strong>{Number(e.brief?.glance?.leadsAdded||0)}</strong><span>Leads today</span></div><div><strong>{Number(e.brief?.followUpHealth?.dueToday||0)}</strong><span>Follow-ups due</span></div><div><strong>{Number(e.brief?.unfinished?.pendingTasks||0)}</strong><span>Open tasks</span></div><div className={Number(e.brief?.unfinished?.overdueTasks||0)?'is-alert':''}><strong>{Number(e.brief?.unfinished?.overdueTasks||0)}</strong><span>Overdue</span></div></div>
        <div className="engage-team-last-activity"><span>Last activity</span><strong>{relative(e.lastEvent||e.lastUpdate)}</strong></div>
      </article>):<div className="engage-team-empty">No employees found.</div>}</div>
    </section>
  </div>;
}
