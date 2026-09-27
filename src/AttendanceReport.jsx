import React, { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";

const C = {
  ink: "#1A1D23",
  soft: "#6B7280",
  line: "#E7E9EE",
  card: "#FFFFFF",
  green: "#12805C",
  amber: "#B8791F",
  red: "#C0392B",
  blue: "#2563EB",
};

function istDay() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function fmtTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function fmtDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const mins = Math.floor(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m}m`;
  return `${h}h ${m}m`;
}

async function loadAllClosingReports(day, employee) {
  const rows = [];
  let offset = 0;
  for (let page = 0; page < 20; page += 1) {
    const params = { day, offset };
    if (employee) params.employee = employee;
    const res = await api.closingReports(params);
    rows.push(...(res.reports || []));
    if (!res.hasMore) break;
    offset += 50;
  }
  return rows;
}

function pill(text, tone) {
  const tones = {
    green: ["#E8F5EF", "#147A5A"],
    amber: ["#FFF5E8", "#9A611A"],
    red: ["#FDECEC", "#A32929"],
    blue: ["#EEF3FF", "#315CB5"],
    gray: ["#F2F4F7", "#667085"],
  };
  const [bg, fg] = tones[tone] || tones.gray;
  return <span style={{ display:"inline-flex", alignItems:"center", padding:"5px 8px", borderRadius:999, background:bg, color:fg, fontSize:11, fontWeight:800, whiteSpace:"nowrap" }}>{text}</span>;
}

export default function AttendanceReport({ salesmen = [] }) {
  const [date, setDate] = useState(istDay());
  const [employee, setEmployee] = useState("");
  const [status, setStatus] = useState("all");
  const [raw, setRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    loadAllClosingReports(date, employee)
      .then((rows) => { if (alive) setRaw(rows); })
      .catch((err) => { if (alive) setError(err.message || "Could not load attendance report."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [date, employee]);

  const rows = useMemo(() => {
    const byEmployee = new Map();
    for (const r of raw) {
      const key = r.user_id;
      if (!byEmployee.has(key)) byEmployee.set(key, { userId:key, name:r.full_name || "Employee", sessions:[] });
      if (r.attendance_id) byEmployee.get(key).sessions.push(r);
    }

    return [...byEmployee.values()].map((item) => {
      const sessions = item.sessions.slice().sort((a,b) => new Date(a.start_day_at || 0) - new Date(b.start_day_at || 0));
      const present = sessions.length > 0;
      const firstStart = present ? sessions[0].start_day_at : null;
      const last = present ? sessions[sessions.length - 1] : null;
      const lastEnd = last?.end_day_at || null;
      const hasOpen = sessions.some((s) => s.start_day_at && !s.end_day_at);
      let durationMs = 0;
      for (const s of sessions) {
        if (!s.start_day_at) continue;
        const start = new Date(s.start_day_at).getTime();
        const end = s.end_day_at ? new Date(s.end_day_at).getTime() : (date === istDay() ? now : start);
        durationMs += Math.max(0, end - start);
      }

      let attendanceStatus = "Not Started";
      if (present && hasOpen) attendanceStatus = "Day Open";
      else if (present) attendanceStatus = "Completed";

      const reportStatuses = sessions.map((s) => s.status).filter(Boolean);
      let closing = "—";
      if (reportStatuses.includes("submitted")) closing = "Submitted";
      else if (reportStatuses.includes("skipped")) closing = "Skipped";
      else if (reportStatuses.includes("draft")) closing = "Draft";
      else if (present && !hasOpen) closing = "Not submitted";
      else if (present) closing = "Pending";

      return {
        ...item,
        present,
        firstStart,
        lastEnd,
        hasOpen,
        durationMs,
        attendanceStatus,
        closing,
        sessionCount: sessions.length,
      };
    });
  }, [raw, date, now]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (status === "all") return true;
    if (status === "present") return r.present;
    return r.attendanceStatus.toLowerCase().replace(/\s+/g, "-") === status;
  }), [rows, status]);

  const summary = useMemo(() => ({
    present: rows.filter((r) => r.present).length,
    notStarted: rows.filter((r) => !r.present).length,
    dayOpen: rows.filter((r) => r.attendanceStatus === "Day Open").length,
    completed: rows.filter((r) => r.attendanceStatus === "Completed").length,
  }), [rows]);

  const summaryCards = [
    ["Present", summary.present, C.green],
    ["Not Started", summary.notStarted, C.red],
    ["Day Open", summary.dayOpen, C.amber],
    ["Completed", summary.completed, C.blue],
  ];

  return <div>
    <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center", marginBottom:14 }}>
      <input type="date" value={date} onChange={(e)=>setDate(e.target.value)} style={{ height:40, border:`1px solid ${C.line}`, borderRadius:10, padding:"0 12px", background:"#fff", color:C.ink, fontSize:13 }} />
      <select value={employee} onChange={(e)=>setEmployee(e.target.value)} style={{ height:40, minWidth:180, border:`1px solid ${C.line}`, borderRadius:10, padding:"0 32px 0 12px", background:"#fff", color:C.ink, fontSize:13 }}>
        <option value="">All Employees</option>
        {salesmen.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <select value={status} onChange={(e)=>setStatus(e.target.value)} style={{ height:40, minWidth:150, border:`1px solid ${C.line}`, borderRadius:10, padding:"0 32px 0 12px", background:"#fff", color:C.ink, fontSize:13 }}>
        <option value="all">All Status</option>
        <option value="present">Present</option>
        <option value="not-started">Not Started</option>
        <option value="day-open">Day Open</option>
        <option value="completed">Completed</option>
      </select>
    </div>

    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,minmax(120px,1fr))", gap:10, marginBottom:16, overflowX:"auto" }}>
      {summaryCards.map(([label,value,color]) => <div key={label} style={{ minWidth:120, background:C.card, border:`1px solid ${C.line}`, borderRadius:12, padding:"12px 14px" }}>
        <div style={{ fontSize:11, color:C.soft, fontWeight:750 }}>{label}</div>
        <div style={{ fontSize:22, fontWeight:850, color, marginTop:4 }}>{value}</div>
      </div>)}
    </div>

    {error && <div style={{ padding:"12px 14px", borderRadius:10, background:"#FDECEC", color:"#A32929", fontSize:12.5, marginBottom:12 }}>{error}</div>}

    <div style={{ background:C.card, border:`1px solid ${C.line}`, borderRadius:14, overflow:"hidden" }}>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:880 }}>
          <thead>
            <tr style={{ background:"#FBFCFD" }}>
              {["Employee","Start Day","End Day","Working Duration","Day Closing","Sessions","Status"].map((h) => <th key={h} style={{ textAlign:"left", padding:"11px 12px", fontSize:10.5, letterSpacing:.35, textTransform:"uppercase", color:C.soft, borderBottom:`1px solid ${C.line}`, fontWeight:800 }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={7} style={{ padding:30, textAlign:"center", color:C.soft, fontSize:12.5 }}>Loading attendance…</td></tr> : filtered.length ? filtered.map((r) => <tr key={r.userId}>
              <td style={{ padding:"12px", borderBottom:`1px solid ${C.line}`, fontSize:12.5, fontWeight:750, color:C.ink }}>{r.name}</td>
              <td style={{ padding:"12px", borderBottom:`1px solid ${C.line}`, fontSize:12.5, color:C.ink }}>{fmtTime(r.firstStart)}</td>
              <td style={{ padding:"12px", borderBottom:`1px solid ${C.line}`, fontSize:12.5, color:C.ink }}>{r.hasOpen ? "—" : fmtTime(r.lastEnd)}</td>
              <td style={{ padding:"12px", borderBottom:`1px solid ${C.line}`, fontSize:12.5, color:C.ink }}>{r.present ? fmtDuration(r.durationMs) : "—"}</td>
              <td style={{ padding:"12px", borderBottom:`1px solid ${C.line}`, fontSize:12.5 }}>{r.closing === "Submitted" ? pill(r.closing,"green") : r.closing === "Skipped" ? pill(r.closing,"amber") : r.closing === "Draft" || r.closing === "Pending" ? pill(r.closing,"blue") : r.closing === "Not submitted" ? pill(r.closing,"red") : pill(r.closing,"gray")}</td>
              <td style={{ padding:"12px", borderBottom:`1px solid ${C.line}`, fontSize:12.5, color:C.ink }}>{r.sessionCount || "—"}</td>
              <td style={{ padding:"12px", borderBottom:`1px solid ${C.line}` }}>{r.attendanceStatus === "Completed" ? pill("Completed","green") : r.attendanceStatus === "Day Open" ? pill("Day Open","amber") : pill("Not Started","gray")}</td>
            </tr>) : <tr><td colSpan={7} style={{ padding:30, textAlign:"center", color:C.soft, fontSize:12.5 }}>No attendance records match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  </div>;
}
