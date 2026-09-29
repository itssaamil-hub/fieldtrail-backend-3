import React, { useEffect, useState } from "react";
import { Battery, Gauge, Clock, Plus, MessageSquare, Sparkles, Search, Settings, Route } from "lucide-react";
import { getApiBase, getSession } from "../api.js";

const fmtTime = (d) => (d ? d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—");
const isThisMonth = (d) => {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

function MonthlyProgressBar({ T, salesmanId, target, leads }) {
  const achieved = leads.filter((l) => l.salesmanId === salesmanId && isThisMonth(l.createdAt)).length;
  const goal = target || 200;
  const pct = Math.min(100, Math.round((achieved / goal) * 100));
  const met = achieved >= goal;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 10.5, color: T.inkSoft, fontWeight: 600 }}>This month</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, color: met ? T.verified : T.route }}>
          {met && "🏆"} {achieved} / {goal}
          <span style={{
            fontSize: 9.5, padding: "1px 6px", borderRadius: 999,
            background: met ? T.verifiedSoft : "#EEF1FD", color: met ? T.verified : T.route,
          }}>{pct}%</span>
        </span>
      </div>
      <div style={{ height: 6, background: T.paperDeep, borderRadius: 999, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`, borderRadius: 999, transition: "width 0.4s ease",
          background: met ? T.verified : `linear-gradient(90deg, ${T.route}, #6E8BF2)`,
        }} />
      </div>
    </div>
  );
}

export default function AdminEmployeesPanel({ salesmen, leads, onAddClick, onSettingsClick, onBriefClick, onDeleteClick, onViewRoute, onMessageClick, onOpenSalesmanLeads, shared }) {
  const { T, inputStyle } = shared;
  const PAGE_SIZE = 8;
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [briefs, setBriefs] = useState({});

  useEffect(() => {
    let live = true;
    const token = getSession()?.token;
    const base = getApiBase();
    if (!token || !base || !salesmen.length) { setBriefs({}); return undefined; }
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    Promise.all(salesmen.map(async (person) => {
      try {
        const res = await fetch(`${base}/admin/salesmen/${encodeURIComponent(person.id)}/brief?date=${day}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        return [person.id, res.ok ? await res.json() : null];
      } catch { return [person.id, null]; }
    })).then((rows) => { if (live) setBriefs(Object.fromEntries(rows)); });
    return () => { live = false; };
  }, [salesmen]);

  const employeeStatus = (s) => {
    if (s.status === "online") return "online";
    const sessions = briefs[s.id]?.sessions || [];
    return sessions.length ? "offline" : "not-started";
  };
  const q = query.trim().toLowerCase();
  const filtered = salesmen.filter((s) => {
    const status = employeeStatus(s);
    const matchesStatus = statusFilter === "all" || status === statusFilter;
    const haystack = `${s.name || ""} ${s.employeeCode || ""} ${s.area || ""}`.toLowerCase();
    return matchesStatus && (!q || haystack.includes(q));
  });
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [query, statusFilter]);

  const briefLine = (s) => {
    const brief = briefs[s.id];
    if (!brief) return "Today · Activity unavailable";
    const session = brief.sessions?.[0];
    const started = session?.startedAt ? `Started ${new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(session.startedAt))}` : "Not started";
    const leadCount = Number(brief.glance?.leadsAdded || 0);
    const followups = Number(brief.followUpHealth?.dueToday || 0);
    const tasks = Number(brief.unfinished?.pendingTasks || 0);
    return `Today · ${started} · ${leadCount} lead${leadCount === 1 ? "" : "s"} · ${followups} follow-up${followups === 1 ? "" : "s"} · ${tasks} task${tasks === 1 ? "" : "s"}`;
  };

  return (
    <div className="ft-card engage-employee-panel-enhanced" style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}>Employees</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => onMessageClick("all")} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, border: `1px solid ${T.line}`, cursor: "pointer", background: "#fff", color: T.ink, fontWeight: 700, fontSize: 12 }}><MessageSquare size={13} /> Message all</button>
          <button onClick={onAddClick} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: T.route, color: "#fff", fontWeight: 700, fontSize: 12 }}><Plus size={13} /> Add Employee</button>
        </div>
      </div>

      <div className="engage-employee-controls" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div className="engage-employee-search-wrap" style={{ flex: "1 1 220px", position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.inkSoft }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} type="search" placeholder="Search employees" aria-label="Search employees" style={{ ...inputStyle, margin: 0, paddingLeft: 31, width: "100%", boxSizing: "border-box" }} />
        </div>
        <div className="engage-employee-filter" style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {[["all","All"],["online","Online"],["offline","Offline"],["not-started","Not started"]].map(([key,label]) => (
            <button key={key} type="button" onClick={() => setStatusFilter(key)} style={{ border: `1px solid ${statusFilter === key ? T.route : T.line}`, background: statusFilter === key ? "#EAF5F0" : "#fff", color: statusFilter === key ? T.route : T.inkSoft, borderRadius: 8, padding: "6px 9px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>{label}</button>
          ))}
        </div>
      </div>

      {salesmen.length === 0 && <div style={{ fontSize: 12.5, color: T.inkSoft }}>No salesmen yet — add your first one.</div>}
      {salesmen.length > 0 && filtered.length === 0 && <div style={{ fontSize: 12.5, color: T.inkSoft, padding: "14px 2px" }}>No employees match these filters.</div>}
      {visible.map((s) => {
        const status = employeeStatus(s);
        return <div key={s.id} className={`ft-row${status === "online" ? " engage-employee-online-card" : ""}`} data-employee-status={status} style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: 12, background: "#fff", opacity: s.isActive === false ? 0.55 : 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div onClick={() => onOpenSalesmanLeads(s)} style={{ fontWeight: 700, fontSize: 13.5, cursor: "pointer", color: T.route }}>{s.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button type="button" className="ft-lead-brief-pill" aria-label={`Brief for ${s.name}`} onClick={() => onBriefClick(s)}><Sparkles size={11} /> Brief</button>
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: s.isActive === false ? "#EEE" : status === "online" ? T.verifiedSoft : "#EEE", color: s.isActive === false ? "#888" : status === "online" ? T.verified : "#888" }}>{s.isActive === false ? "Deactivated" : status === "online" ? "Online" : status === "not-started" ? "Not started" : "Offline"}</span>
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 3 }}>{s.area}{s.employeeCode ? ` · ${s.employeeCode}` : ""}</div>
          <div className="engage-employee-today" style={{ fontSize: 11, color: T.inkSoft, marginTop: 7 }}>{briefLine(s)}</div>
          <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11, color: T.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Battery size={12} /> {s.battery != null ? `${Math.round(s.battery)}%` : "—"}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Gauge size={12} /> {s.speed.toFixed(1)} km/h</span>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Clock size={12} /> {fmtTime(s.lastUpdate)}</span>
          </div>
          <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 3 }}>{(s.distanceM / 1000).toFixed(1)} km travelled today</div>
          <MonthlyProgressBar T={T} salesmanId={s.id} target={s.monthlyTarget} leads={leads} />
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
            <button onClick={() => onViewRoute(s)} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: T.route, background: "none", border: "none", cursor: "pointer", padding: 0 }}><Route size={12} /> View route</button>
            <button onClick={() => onMessageClick(s)} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: T.route, background: "none", border: "none", cursor: "pointer", padding: 0 }}><MessageSquare size={12} /> Message</button>
            <button onClick={() => onSettingsClick(s)} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: T.inkSoft, background: "none", border: "none", cursor: "pointer", padding: 0 }}><Settings size={12} /> Settings</button>
          </div>
        </div>;
      })}

      {filtered.length > PAGE_SIZE && <div className="engage-employee-pagination" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, paddingTop: 4 }}>
        <span style={{ fontSize: 11.5, color: T.inkSoft }}>{(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" disabled={safePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
          <button type="button" disabled={safePage === pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>Next</button>
        </div>
      </div>}
    </div>
  );
}
