import React from "react";
import { Battery, Gauge, Clock, Plus, MessageSquare, Search, Settings, Route, FileText, ChevronRight, MapPin, ListChecks, BarChart3, CalendarDays } from "lucide-react";
import "./employee-cards.css";

const count = (value) => value != null && Number.isFinite(Number(value)) ? Number(value) : null;
const time = (value) => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true }).format(date)
    : null;
};

function LeadProgress({ label, value, target, loading, error }) {
  const goal = count(target);
  const percent = value != null && goal > 0 ? Math.max(0, Math.min(100, value / goal * 100)) : null;
  return <div className="emp-progress">
    <div className="emp-progress-label"><span>{label}</span><strong>{loading ? "…" : error ? "Unavailable" : value == null ? "—" : <>{value}{goal > 0 ? ` / ${goal}` : " leads"}</>}</strong></div>
    {!loading && !error && percent != null && <div className="emp-progress-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(value, goal)} aria-valuetext={`${value} of ${goal} leads`}><span style={{ width: `${percent}%` }} /></div>}
  </div>;
}

export default function EmployeeCardsView({ salesmen, visible, filteredCount, briefs, employeeStatus, query, setQuery, statusFilter, setStatusFilter, monthFilter, setMonthFilter, monthOptions, year, metrics, metricsLoading, metricsError, page, pages, pageSize, setPage, onAddClick, onSettingsClick, onBriefClick, onViewRoute, onMessageClick, onOpenSalesmanLeads }) {
  return <section className="emp-page" aria-label="Employees">
    <header className="emp-page-header">
      <div><h2>Employees</h2><p>Your team at a glance</p></div>
      <div className="emp-header-actions">
        <button type="button" onClick={() => onMessageClick("all")}><MessageSquare size={16} /> Message all</button>
        <button type="button" className="emp-primary" onClick={onAddClick}><Plus size={17} /><span>Add employee</span></button>
      </div>
    </header>
    <div className="emp-controls">
      <label className="emp-search"><Search size={17} /><input type="search" aria-label="Search employees" placeholder="Search employees by name, code or location…" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
      <label className="emp-month"><CalendarDays size={16} /><select aria-label="Employee lead month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}><option value="all">All time</option>{monthOptions.map((option) => <option key={option.value} value={option.value}>{option.label} {year}</option>)}</select></label>
      <div className="emp-filters" aria-label="Employee status">
        {[["all", "All"], ["online", "Working"], ["offline", "Offline"], ["not-started", "Not started"]].map(([key, label]) => <button type="button" key={key} aria-pressed={statusFilter === key} onClick={() => setStatusFilter(key)}>{label}</button>)}
      </div>
    </div>
    {!filteredCount && <p className="emp-empty">{salesmen.length ? "No employees match these filters." : "No employees yet — add your first one."}</p>}
    <div className="emp-grid">
      {visible.map((s) => {
        const brief = briefs[s.id];
        const loading = !Object.prototype.hasOwnProperty.call(briefs, s.id);
        const status = employeeStatus(s);
        const state = s.isActive === false ? "Deactivated" : status === "online" ? "Working" : status === "not-started" ? "Not started" : status === "unavailable" ? (loading ? "Loading…" : "Unavailable") : "Offline";
        const started = time(brief?.sessions?.[0]?.startedAt);
        const daily = count(brief?.glance?.leadsAdded);
        const monthly = count(metrics[s.id]?.leads_created);
        const battery = count(s.battery), speed = count(s.speed), distance = count(s.distanceM);
        return <article className="emp-card" key={s.id} aria-label={`${s.name} employee card`} data-status={state}>
          <div className="emp-card-header">
            <span className="emp-avatar" aria-hidden="true">{(s.name || "?").trim().slice(0, 1).toUpperCase()}</span>
            <div className="emp-identity"><button type="button" onClick={() => onOpenSalesmanLeads(s)}>{s.name}<ChevronRight size={16} /></button><p>{s.area}{s.employeeCode ? ` · ${s.employeeCode}` : ""}</p></div>
            <span className="emp-status"><i className={state === "Working" ? "is-working" : ""} />{state}</span>
          </div>
          <div className="emp-start"><Clock size={14} /><span>Today · {loading ? "Loading activity…" : !brief ? "Activity unavailable" : started ? <>Started <strong>{started}</strong></> : "Not started"}</span></div>
          <div className="emp-metrics">
            {[[BarChart3, "Leads today", daily], [ListChecks, "Follow-ups due", count(brief?.followUpHealth?.dueToday)], [CalendarDays, "Pending tasks", count(brief?.unfinished?.pendingTasks)]].map(([Icon, label, value]) => <div className="emp-metric" key={label}><Icon size={17} /><div><span>{label}</span><strong>{loading ? "…" : value ?? "—"}</strong></div></div>)}
          </div>
          <div className="emp-progress-grid">
            <LeadProgress label="Daily leads" value={daily} target={s.dailyTarget} loading={loading} error={!loading && !brief} />
            <LeadProgress label={monthFilter === "all" ? "All-time leads" : "Monthly leads"} value={monthly} target={monthFilter === "all" ? null : s.monthlyTarget} loading={metricsLoading} error={metricsError} />
          </div>
          <div className="emp-telemetry">
            <div><span><Battery size={14} /> Battery {battery == null ? "—" : `${Math.round(battery)}%`}</span><span><Gauge size={14} />{speed == null ? "—" : speed.toFixed(1)} km/h</span><span><Clock size={14} />Updated {time(s.lastUpdate) || "—"}</span></div>
            <span><MapPin size={14} />{distance == null ? "—" : (distance / 1000).toFixed(1)} km travelled today</span>
          </div>
          <div className="emp-card-actions">
            <button type="button" onClick={() => onBriefClick(s)}><FileText size={16} />Daily Brief</button>
            <button type="button" onClick={() => onViewRoute(s)}><Route size={16} />View Route</button>
            <button type="button" onClick={() => onMessageClick(s)}><MessageSquare size={16} />Message</button>
            <button type="button" onClick={() => onSettingsClick(s)}><Settings size={16} />Settings</button>
          </div>
        </article>;
      })}
    </div>
    {filteredCount > pageSize && <nav className="emp-pagination" aria-label="Employee pages"><span>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredCount)} of {filteredCount}</span><div><button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><button type="button" disabled={page === pages} onClick={() => setPage(page + 1)}>Next</button></div></nav>}
  </section>;
}
