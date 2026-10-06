import React, { useEffect, useMemo, useState } from 'react';
import { getApiBase, getSession } from './api.js';
import { attendanceV2Api } from './attendanceV2Api.js';

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
      <div className="engage-mobile-lead-trend-sub">Last 7 days · {currentTotal} lead{currentTotal===1?'':'s'}</div>
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
  const [briefs, setBriefs] = useState({});
  const [attendance, setAttendance] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    const base = getApiBase();
    const token = getSession()?.token;
    if (!base || !token) {
      setLoading(false);
      return undefined;
    }
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone:'Asia/Kolkata', year:'numeric', month:'2-digit', day:'2-digit',
    }).format(new Date());

    Promise.all([
      Promise.all(salesmen.map(async (s) => {
        try {
          const r = await fetch(`${base}/admin/salesmen/${encodeURIComponent(s.id)}/brief?date=${day}`, {
            headers:{ Authorization:`Bearer ${token}` },
          });
          return [s.id, r.ok ? await r.json() : null];
        } catch {
          return [s.id, null];
        }
      })),
      attendanceV2Api.report({ from:day, to:day }).catch(() => null),
    ]).then(([rows, report]) => {
      if (!live) return;
      setBriefs(Object.fromEntries(rows));
      setAttendance(report);
      setLoading(false);
    });

    return () => { live = false; };
  }, [salesmen]);

  useEffect(() => {
    const key = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [onClose]);

  const attendanceByEmployee = useMemo(() => {
    const map = new Map();
    for (const employee of attendance?.employees || []) {
      map.set(String(employee.userId), employee.details?.[0] || null);
    }
    return map;
  }, [attendance]);

  const employees = salesmen.map((s) => {
    const brief = briefs[s.id] || null;
    const day = attendanceByEmployee.get(String(s.id)) || null;
    const sessions = brief?.sessions || [];
    const first = sessions[0] || null;
    const last = sessions[sessions.length - 1] || null;
    const exceptionKind = day?.exception?.kind || null;

    let status = 'unavailable';
    if (exceptionKind === 'leave' || day?.state === 'leave') status = 'leave';
    else if (day?.hasOpen === true) status = 'working';
    else if ((day?.sessions?.length || 0) > 0 && day?.hasOpen === false) status = 'ended';
    else if (day?.state === 'Not Started') status = 'not-started';
    else if (['weekly_off','holiday','Off Day'].includes(day?.state) || ['weekly_off','holiday'].includes(exceptionKind)) status = 'off-day';

    const lateMinutes = Number.isFinite(Number(first?.lateMinutes)) ? Number(first.lateMinutes) : null;
    const closingRows = brief?.closing || [];
    let closing = 'Unavailable';
    if (closingRows.some((row) => row.status === 'submitted')) closing = 'Submitted';
    else if (closingRows.some((row) => row.status === 'skipped')) closing = 'Skipped';
    else if (day?.closing?.pending === true) closing = 'Pending';
    else if (day?.closing?.required === false) closing = 'Not required';

    const exceptions = (day?.anomalies || [])
      .filter((item) => !['late_start','closing_pending'].includes(item.type))
      .map((item) => item.type === 'gps_missing' ? 'Missing GPS'
        : item.type === 'missing_end' ? 'Missing End Day'
        : item.label)
      .filter(Boolean);

    return {
      ...s,
      brief,
      day,
      status,
      first,
      last,
      lateMinutes,
      closing,
      exceptions,
    };
  });

  const counts = employees.reduce((acc, employee) => {
    acc[employee.status] = (acc[employee.status] || 0) + 1;
    return acc;
  }, {});

  const visible = employees.filter((employee) => {
    const matchesQuery = !query.trim() || String(employee.name || '').toLowerCase().includes(query.trim().toLowerCase());
    const matchesFilter = filter === 'all' || employee.status === filter;
    return matchesQuery && matchesFilter;
  });

  const statusLabel = (status) => status === 'working' ? 'Working'
    : status === 'not-started' ? 'Not Started'
    : status === 'leave' ? 'On Leave'
    : status === 'ended' ? 'Ended Day'
    : status === 'off-day' ? 'Off Day'
    : 'Unavailable';

  const tabs = [
    ['all', 'All', employees.length],
    ['working', 'Working', counts.working || 0],
    ['not-started', 'Not Started', counts['not-started'] || 0],
    ['leave', 'On Leave', counts.leave || 0],
    ['ended', 'Ended Day', counts.ended || 0],
  ];

  return <div id="engage-admin-team-activity-sheet" className="engage-team-sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <section className="engage-team-sheet" role="dialog" aria-modal="true" aria-label="Employees Today">
      <div className="engage-team-sheet-head">
        <div>
          <h2>Employees — Today</h2>
          <p className="engage-team-summary-text">Total {employees.length} · {counts.working || 0} active now</p>
        </div>
        <button type="button" className="engage-team-close" aria-label="Close" onClick={onClose}>×</button>
      </div>

      <div className="engage-team-status-tabs" role="tablist" aria-label="Employee work status">
        {tabs.map(([key, label, count]) => <button
          key={key}
          type="button"
          role="tab"
          aria-selected={filter === key}
          className={filter === key ? 'is-active' : ''}
          onClick={() => setFilter(key)}
        >{label} ({count})</button>)}
      </div>

      <div className="engage-team-search-wrap">
        <span>⌕</span>
        <input type="search" placeholder="Search employees…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="engage-team-list">
        {loading ? <div className="engage-team-empty">Loading…</div> : visible.length ? visible.map((employee) => {
          const brief = employee.brief;
          const dueToday = brief?.unfinished?.dueTodayTasks;
          const overdue = brief?.unfinished?.overdueTasks;
          const taskText = dueToday == null || overdue == null ? 'Unavailable' : `${Number(dueToday)} due · ${Number(overdue)} overdue`;
          const area = [employee.area && employee.area !== 'Unassigned' ? employee.area : '', employee.city || ''].filter(Boolean).join(' · ') || 'Unavailable';

          return <article key={employee.id} className="engage-team-employee-card" data-status={employee.status} aria-label={`${employee.name} today status`}>
            <div className="engage-team-employee-top">
              <div className="engage-team-avatar">{initials(employee.name)}</div>
              <div className="engage-team-employee-name-wrap">
                <div className="engage-team-employee-name">{employee.name}</div>
                <div className="engage-team-employee-role">{area}</div>
              </div>
              <span className="engage-team-status">{statusLabel(employee.status)}</span>
            </div>

            <div className="engage-team-live-row">
              <span>{employee.first?.startedAt ? <>Started <strong>{fmtTime(employee.first.startedAt)}</strong></> : 'Not started yet'}</span>
              {employee.lateMinutes > 0 && <strong className="engage-team-late">{Math.round(employee.lateMinutes)} min late</strong>}
              {employee.lateMinutes === 0 && employee.first?.startedAt && <strong className="engage-team-on-time">On time</strong>}
            </div>

            <div className="engage-team-live-row">
              <span>Last seen <strong>{relative(employee.lastUpdate) === '—' ? 'Unavailable' : relative(employee.lastUpdate)}</strong></span>
              <span>Area <strong>{area}</strong></span>
            </div>

            <div className="engage-team-metrics engage-team-metrics-today">
              <div><strong>{brief ? Number(brief.glance?.leadsAdded || 0) : '—'}</strong><span>Leads today</span></div>
              <div><strong>{brief ? Number(brief.followUpHealth?.dueToday || 0) : '—'}</strong><span>Follow-ups due</span></div>
              <div className={Number(overdue || 0) > 0 ? 'is-alert' : ''}><strong>{brief ? taskText : '—'}</strong><span>Tasks today</span></div>
            </div>

            <div className="engage-team-closing-row">
              <span>Day Closing</span>
              <strong data-closing={employee.closing.toLowerCase().replace(/\\s+/g, '-')}>{employee.closing}</strong>
            </div>

            {employee.exceptions.length > 0 && <div className="engage-team-exceptions">
              {employee.exceptions.slice(0, 2).map((label) => <span key={label}>⚠ {label}</span>)}
            </div>}
          </article>;
        }) : <div className="engage-team-empty">No employees found.</div>}
      </div>
    </section>
  </div>;
}

