import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  Search,
  Database,
  ShieldCheck,
  CircleAlert,
  TriangleAlert,
  ChevronDown,
  ChevronUp,
  Clock3,
} from 'lucide-react';
import { getApiBase, getSession } from './api.js';

const pretty = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, m => m.toUpperCase());
const fmtDate = value => {
  try {
    return value
      ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
      : '—';
  } catch {
    return String(value || '—');
  }
};

async function get(path) {
  const base = getApiBase(), token = getSession()?.token;
  if (!base || !token) throw new Error('Admin session or backend URL is missing.');
  const r = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  let data = null;
  try { data = await r.json(); } catch {}
  if (!r.ok) throw new Error(data?.error || `Request failed (${r.status})`);
  return data;
}

function status(check) {
  if (check.ok) return { label: 'Healthy', tone: 'good', Icon: CheckCircle2 };
  if (check.severity === 'critical') return { label: 'Critical', tone: 'critical', Icon: AlertTriangle };
  return { label: 'Warning', tone: 'warning', Icon: AlertTriangle };
}

function DetailRows({ checkKey }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    get(`/admin/data-health/details/${encodeURIComponent(checkKey)}`)
      .then(v => live && setData(v))
      .catch(e => live && setError(e.message));
    return () => { live = false; };
  }, [checkKey]);

  if (error) return <div className="dh-detail-state dh-detail-error">{error}</div>;
  if (!data) return <div className="dh-detail-state">Loading affected records…</div>;
  if (!(data.rows || []).length) return <div className="dh-detail-state">No affected records found.</div>;

  return (
    <div className="dh-detail-list">
      {data.rows.map((row, i) => (
        <div key={i} className="dh-detail-row">
          <div className="dh-record-title">Record {i + 1}</div>
          <div className="dh-record-grid">
            {Object.entries(row)
              .filter(([, v]) => v !== null)
              .map(([k, v]) => (
                <div key={k}>
                  <div className="dh-record-label">{pretty(k)}</div>
                  <div className="dh-record-value">
                    {/_at$|time|started|finished|updated/.test(k) && typeof v === 'string'
                      ? fmtDate(v)
                      : typeof v === 'boolean'
                        ? (v ? 'Yes' : 'No')
                        : String(v)}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
      {data.limited && <div className="dh-detail-limit">Showing first 50 affected records.</div>}
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, tone = 'neutral' }) {
  return (
    <div className={`dh-summary-card dh-summary-${tone}`}>
      <div className="dh-summary-icon"><Icon size={18} strokeWidth={2.1} /></div>
      <div>
        <div className="dh-summary-label">{label}</div>
        <div className="dh-summary-value">{value}</div>
      </div>
    </div>
  );
}

export default function DataHealth({ onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('issues');
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(null);

  const load = () => {
    setLoading(true);
    setError('');
    get('/admin/data-health')
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const key = e => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [onClose]);

  const checks = data?.checks || [];
  const categories = useMemo(() => [...new Set(checks.map(c => c.category || 'Other'))], [checks]);
  const attentionCount = checks.filter(c => !c.ok).length;
  const visible = checks.filter(c =>
    (tab === 'all' || !c.ok) &&
    (category === 'all' || (c.category || 'Other') === category) &&
    (!query.trim() || `${c.title || pretty(c.key)} ${c.why || ''}`.toLowerCase().includes(query.trim().toLowerCase()))
  );
  const critical = Number(data?.summary?.critical || 0);
  const warnings = Number(data?.summary?.warning || 0);
  const healthy = checks.filter(c => c.ok).length;

  const healthTone = critical ? 'critical' : warnings ? 'warning' : 'good';
  const healthTitle = critical
    ? 'Critical data issues found'
    : warnings
      ? 'Backend healthy with warnings'
      : 'Everything looks healthy';

  return (
    <div
      className="dh-backdrop"
      onMouseDown={e => e.target === e.currentTarget && onClose()}
    >
      <style>{`
        .dh-backdrop{position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.52);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;backdrop-filter:blur(3px)}
        .dh-dialog{width:min(1180px,100%);height:min(900px,92vh);background:#f7f8fa;border:1px solid rgba(226,232,240,.95);border-radius:24px;box-shadow:0 32px 90px rgba(15,23,42,.28);display:flex;flex-direction:column;overflow:hidden;color:#1f2937}
        .dh-header{display:flex;justify-content:space-between;gap:18px;padding:22px 24px;background:#fff;border-bottom:1px solid #e8ebf0;align-items:flex-start}
        .dh-title-row{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.dh-title{font-size:24px;line-height:1.05;font-weight:900;letter-spacing:-.55px;color:#20242c}.dh-badge{font-size:11px;font-weight:800;color:#145c5d;background:#e8f3f2;padding:5px 9px;border-radius:999px;letter-spacing:.02em}.dh-subtitle{font-size:14px;color:#6b7280;margin-top:7px}
        .dh-header-actions{display:flex;gap:10px}.dh-icon-btn,.dh-refresh{border:1px solid #e2e6ec;background:#fff;border-radius:12px;min-height:40px;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:800;color:#252a32;cursor:pointer;transition:.16s ease;box-shadow:0 1px 2px rgba(15,23,42,.03)}.dh-refresh{padding:0 14px}.dh-icon-btn{width:40px}.dh-icon-btn:hover,.dh-refresh:hover{border-color:#cfd6df;background:#fafbfc;transform:translateY(-1px)}.dh-refresh:disabled{opacity:.55;cursor:default;transform:none}
        .dh-body{padding:22px 24px 28px;overflow:auto}.dh-banner{display:flex;align-items:center;gap:13px;padding:18px 20px;border-radius:18px;border:1px solid transparent;margin-bottom:16px}.dh-banner-critical{background:#fff1ef;border-color:#ffd8d2}.dh-banner-warning{background:#fff8e8;border-color:#f7e4b4}.dh-banner-good{background:#eef9f4;border-color:#d4eee2}.dh-banner-icon{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;flex:0 0 auto}.dh-banner-critical .dh-banner-icon{background:#ffe2de;color:#c24132}.dh-banner-warning .dh-banner-icon{background:#ffedbf;color:#a96d12}.dh-banner-good .dh-banner-icon{background:#daf2e7;color:#13805c}.dh-banner-title{font-size:18px;font-weight:900;letter-spacing:-.25px}.dh-banner-critical .dh-banner-title{color:#bc3d30}.dh-banner-warning .dh-banner-title{color:#9b6715}.dh-banner-good .dh-banner-title{color:#137458}.dh-banner-meta{font-size:12.5px;color:#667085;margin-top:3px}
        .dh-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:18px}.dh-summary-card{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #e3e7ed;border-radius:16px;padding:15px 16px;box-shadow:0 1px 2px rgba(15,23,42,.03)}.dh-summary-icon{width:36px;height:36px;border-radius:11px;display:grid;place-items:center;background:#f1f4f7;color:#586171;flex:0 0 auto}.dh-summary-good .dh-summary-icon{background:#e9f7f1;color:#14805e}.dh-summary-critical .dh-summary-icon{background:#fff0ee;color:#c24435}.dh-summary-warning .dh-summary-icon{background:#fff7e8;color:#a76e17}.dh-summary-label{font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;font-weight:800;color:#7b8493}.dh-summary-value{font-size:25px;font-weight:900;letter-spacing:-.6px;margin-top:1px;color:#20242c}
        .dh-toolbar{display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap}.dh-tabs{display:inline-flex;padding:4px;background:#eceff3;border-radius:12px;gap:3px}.dh-tab{border:0;background:transparent;border-radius:9px;padding:8px 12px;font-size:12.5px;font-weight:800;color:#667085;cursor:pointer}.dh-tab.active{background:#fff;color:#1f2937;box-shadow:0 1px 3px rgba(15,23,42,.08)}.dh-search{margin-left:auto;position:relative;min-width:250px}.dh-search svg{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:#9aa1ad}.dh-search input{width:100%;height:38px;border:1px solid #dde2e8;border-radius:11px;background:#fff;padding:0 12px 0 34px;box-sizing:border-box;font-size:12.5px;outline:none;color:#1f2937}.dh-search input:focus{border-color:#9fb8b8;box-shadow:0 0 0 3px rgba(20,92,93,.08)}
        .dh-categories{display:flex;gap:7px;overflow-x:auto;padding:2px 0 10px;margin-bottom:2px;scrollbar-width:thin}.dh-chip{white-space:nowrap;border:1px solid #dfe4ea;background:#fff;color:#626b79;border-radius:999px;padding:7px 11px;font-size:12px;font-weight:750;cursor:pointer}.dh-chip.active{background:#153f40;color:#fff;border-color:#153f40}
        .dh-list{display:flex;flex-direction:column;gap:10px}.dh-card{border:1px solid #e2e6ec;border-radius:16px;background:#fff;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,.025)}.dh-card.critical{background:#fff5f3;border-color:#f5d3cd}.dh-card.warning{background:#fffaf0;border-color:#f0dfb7}.dh-card-main{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:13px;padding:16px 17px}.dh-card-icon{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:#f2f4f7;color:#5f6977}.dh-card.critical .dh-card-icon{background:#ffe8e4;color:#bf4334}.dh-card.warning .dh-card-icon{background:#fff0ca;color:#a96e15}.dh-card-title{font-size:14px;font-weight:850;color:#262b33}.dh-card-copy{font-size:12px;color:#6e7785;margin-top:4px;line-height:1.45}.dh-status{display:flex;align-items:baseline;gap:6px;font-weight:900;color:#252a32;white-space:nowrap}.dh-status-count{font-size:18px}.dh-status-label{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6d7582}.dh-card-footer{padding:0 17px 15px}.dh-record-btn{border:0;background:transparent;color:#145c5d;padding:0;font-size:12px;font-weight:850;display:inline-flex;align-items:center;gap:6px;cursor:pointer}.dh-record-btn:hover{text-decoration:underline}.dh-detail-wrap{margin-top:12px;border:1px solid #e0e5eb;border-radius:12px;overflow:hidden;background:#fff}.dh-detail-state{padding:14px;color:#6b7280;font-size:12px}.dh-detail-error{color:#c0392b}.dh-detail-row{padding:13px 14px;border-top:1px solid #edf0f3}.dh-detail-row:first-child{border-top:0}.dh-record-title{font-size:11px;font-weight:850;color:#343a43}.dh-record-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px 14px;margin-top:9px}.dh-record-label{font-size:9px;text-transform:uppercase;font-weight:850;letter-spacing:.05em;color:#8a93a1}.dh-record-value{font-size:11.5px;margin-top:3px;word-break:break-word;color:#313741}.dh-detail-limit{padding:10px 14px;font-size:10.5px;color:#707886;border-top:1px solid #edf0f3;background:#fafbfc}
        .dh-empty{background:#fff;border:1px dashed #d8dee6;border-radius:16px;padding:34px;text-align:center;color:#77808e;font-size:13px}.dh-system{background:#fff;border:1px solid #e2e6ec;border-radius:16px;overflow:hidden}.dh-system-head{padding:15px 17px;font-size:13px;font-weight:850;display:flex;align-items:center;gap:8px}.dh-job{display:grid;grid-template-columns:1.1fr 1fr 1fr;gap:12px;padding:14px 17px;border-top:1px solid #edf0f3;font-size:12px;align-items:center}.dh-job-label{font-weight:800}.dh-loading{padding:52px 20px;text-align:center;color:#737c89;font-size:13px}.dh-error{padding:15px;border-radius:14px;background:#fff0ee;color:#b83d30;font-weight:750;border:1px solid #f4d2cc}
        @media(max-width:780px){.dh-backdrop{padding:0}.dh-dialog{width:100%;height:100%;max-height:none;border-radius:0;border:0}.dh-header{padding:18px 16px}.dh-title{font-size:21px}.dh-subtitle{font-size:12.5px}.dh-refresh span{display:none}.dh-refresh{width:40px;padding:0}.dh-body{padding:16px}.dh-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.dh-summary-card{padding:12px}.dh-toolbar{align-items:stretch}.dh-tabs{width:100%;display:grid;grid-template-columns:repeat(3,1fr)}.dh-tab{padding:8px 7px}.dh-search{min-width:0;width:100%;margin-left:0}.dh-card-main{grid-template-columns:auto minmax(0,1fr);align-items:flex-start}.dh-status{grid-column:2;margin-top:1px}.dh-job{grid-template-columns:1fr}.dh-banner{padding:15px}.dh-banner-title{font-size:16px}}
        @media(max-width:480px){.dh-summary-icon{display:none}.dh-summary-card{padding:12px 13px}.dh-summary-value{font-size:22px}.dh-title-row{gap:6px}.dh-badge{font-size:9.5px}.dh-card-main{padding:14px}.dh-card-footer{padding:0 14px 14px}}
      `}</style>

      <div role="dialog" aria-modal="true" aria-label="Data Health" className="dh-dialog">
        <header className="dh-header">
          <div>
            <div className="dh-title-row">
              <div className="dh-title">Data Health</div>
              <span className="dh-badge">Control Centre</span>
            </div>
            <div className="dh-subtitle">Live integrity, consistency and system checks for Engage</div>
          </div>
          <div className="dh-header-actions">
            <button className="dh-refresh" onClick={load} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
              <span>Refresh</span>
            </button>
            <button className="dh-icon-btn" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="dh-body">
          {loading && <div className="dh-loading">Running backend integrity checks…</div>}
          {error && <div className="dh-error">{error}</div>}

          {data && !loading && <>
            <div className={`dh-banner dh-banner-${healthTone}`}>
              <div className="dh-banner-icon">
                {critical ? <CircleAlert size={21} /> : warnings ? <TriangleAlert size={21} /> : <ShieldCheck size={21} />}
              </div>
              <div>
                <div className="dh-banner-title">{healthTitle}</div>
                <div className="dh-banner-meta">Last checked {fmtDate(data.checkedAt)}</div>
              </div>
            </div>

            <div className="dh-summary-grid">
              <SummaryCard label="Checks" value={checks.length} icon={Database} />
              <SummaryCard label="Healthy" value={healthy} icon={ShieldCheck} tone="good" />
              <SummaryCard label="Critical records" value={critical} icon={CircleAlert} tone="critical" />
              <SummaryCard label="Warning records" value={warnings} icon={TriangleAlert} tone="warning" />
            </div>

            <div className="dh-toolbar">
              <div className="dh-tabs">
                <button className={`dh-tab ${tab === 'issues' ? 'active' : ''}`} onClick={() => setTab('issues')}>
                  Needs attention ({attentionCount})
                </button>
                <button className={`dh-tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
                  All checks ({checks.length})
                </button>
                <button className={`dh-tab ${tab === 'system' ? 'active' : ''}`} onClick={() => setTab('system')}>
                  System
                </button>
              </div>

              {tab !== 'system' && (
                <label className="dh-search">
                  <Search size={15} />
                  <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search checks…" />
                </label>
              )}
            </div>

            {tab === 'system' ? (
              <div className="dh-system">
                <div className="dh-system-head"><Clock3 size={16} /> Scheduled jobs</div>
                {(data.system?.jobs || []).map((j, i) => (
                  <div key={j.job_key || i} className="dh-job">
                    <div className="dh-job-label">{pretty(j.job_key)}</div>
                    <div><strong>Last success</strong><br />{fmtDate(j.last_success)}</div>
                    <div><strong>Last attempt</strong><br />{fmtDate(j.last_attempt)}</div>
                  </div>
                ))}
                {!(data.system?.jobs || []).length && <div className="dh-empty">No scheduled job data available.</div>}
              </div>
            ) : <>
              <div className="dh-categories">
                <button className={`dh-chip ${category === 'all' ? 'active' : ''}`} onClick={() => setCategory('all')}>All</button>
                {categories.map(c => (
                  <button key={c} className={`dh-chip ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>{c}</button>
                ))}
              </div>

              <div className="dh-list">
                {visible.map(check => {
                  const s = status(check), Icon = s.Icon;
                  return (
                    <div key={check.key} className={`dh-card ${check.ok ? 'healthy' : s.tone}`}>
                      <div className="dh-card-main">
                        <div className="dh-card-icon"><Icon size={18} /></div>
                        <div>
                          <div className="dh-card-title">{check.title || pretty(check.key)}</div>
                          <div className="dh-card-copy">{check.why || 'Backend integrity check'}</div>
                        </div>
                        <div className="dh-status">
                          <span className="dh-status-count">{check.ok ? 'OK' : Number(check.count || 0)}</span>
                          <span className="dh-status-label">{s.label}</span>
                        </div>
                      </div>

                      {!check.ok && check.detailsAvailable && (
                        <div className="dh-card-footer">
                          <button
                            className="dh-record-btn"
                            onClick={() => setExpanded(expanded === check.key ? null : check.key)}
                          >
                            {expanded === check.key ? 'Hide affected records' : 'View affected records'}
                            {expanded === check.key ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                          {expanded === check.key && (
                            <div className="dh-detail-wrap"><DetailRows checkKey={check.key} /></div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {!visible.length && <div className="dh-empty">No checks match the selected filters.</div>}
              </div>
            </>}
          </>}
        </div>
      </div>
    </div>
  );
}
