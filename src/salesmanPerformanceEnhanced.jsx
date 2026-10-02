import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { AlertTriangle, CalendarDays, ClipboardCheck, Target } from "lucide-react";
import { getApiBase, getSession } from "./api.js";

const C = {
  ink: "#1A1D23",
  heading: "#183738",
  soft: "#6B7280",
  line: "#E4E8EB",
  lineSoft: "#EDF0F2",
  green: "#145C5D",
  green2: "#12805C",
  greenSoft: "#EDF7F5",
  amber: "#A15C0A",
  amberSoft: "#FFF7ED",
  red: "#AA3428",
  redSoft: "#FDE9E7",
};

function fmtMoney(value) {
  const n = Number(value || 0);
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1).replace(/\.0$/, "")}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1).replace(/\.0$/, "")}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function pct(value, target) {
  const t = Number(target || 0);
  return t > 0 ? Math.round((Number(value || 0) / t) * 100) : 0;
}

function istDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function shiftDay(day, amount) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}

function monthStart(day) { return `${day.slice(0, 7)}-01`; }
function previousMonth(day) {
  const [y, m] = day.slice(0, 7).split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 2, 1, 12));
  const end = new Date(Date.UTC(y, m - 1, 0, 12));
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

function rangeLabel(from, to) {
  const f = new Date(`${from}T12:00:00Z`), t = new Date(`${to}T12:00:00Z`);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  if (sameMonth) return `${f.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })} – ${t.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`;
  if (sameYear) return `${f.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })} – ${t.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`;
  return `${f.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })} – ${t.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`;
}

async function loadPerformance(from, to) {
  const base = getApiBase();
  const token = getSession()?.token || "";
  if (!base) throw new Error("No backend configured yet.");
  const qs = new URLSearchParams({ from, to });
  const response = await fetch(`${base}/salesman/my-performance?${qs}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  let data = null;
  try { data = await response.json(); } catch { /* no body */ }
  if (!response.ok) throw new Error(data?.error || `Request failed (${response.status})`);
  return data;
}

function Progress({ value, target, tone = C.green }) {
  const p = Math.max(0, Math.min(100, pct(value, target)));
  return <div style={{ height: 6, background: "#EDF2F1", borderRadius: 99, overflow: "hidden", marginTop: 8 }}><div style={{ width: `${p}%`, height: "100%", background: tone, borderRadius: 99, transition: "width .25s ease" }} /></div>;
}

function StatusChip({ children, tone = "good" }) {
  const styles = tone === "risk" ? { background: C.redSoft, color: C.red } : tone === "warn" ? { background: "#FFF0DF", color: C.amber } : { background: C.greenSoft, color: C.green2 };
  return <span style={{ ...styles, borderRadius: 999, padding: "4px 8px", fontSize: 10.5, fontWeight: 800, whiteSpace: "nowrap" }}>{children}</span>;
}

function MetricRow({ label, value, detail, chip, chipTone, progress, target, progressTone }) {
  return <div style={{ padding: "13px 0", borderBottom: `1px solid ${C.lineSoft}` }}>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, alignItems: "center" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#233637" }}>{label}</div>
        {detail && <div style={{ fontSize: 10.8, color: C.soft, marginTop: 3, lineHeight: 1.35 }}>{detail}</div>}
      </div>
      <div style={{ textAlign: "right", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, minWidth: 0 }}>
        <strong style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, lineHeight: 1, color: "#173738" }}>{value}</strong>
        {chip && <StatusChip tone={chipTone}>{chip}</StatusChip>}
      </div>
    </div>
    {progress != null && Number(target || 0) > 0 && <Progress value={progress} target={target} tone={progressTone || C.green} />}
  </div>;
}

function Panel({ title, subtitle, icon: Icon, accent = C.green, children }) {
  return <section style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 15, overflow: "hidden" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "13px 14px", borderBottom: `1px solid ${C.lineSoft}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", background: "#F2F6F5", color: accent, flexShrink: 0 }}><Icon size={15} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14.5, fontWeight: 700, color: "#223A3B" }}>{title}</div>
          {subtitle && <div style={{ fontSize: 10.5, color: "#7A8385", marginTop: 2 }}>{subtitle}</div>}
        </div>
      </div>
    </div>
    <div style={{ padding: "0 14px" }}>{children}</div>
  </section>;
}

function SalesmanPerformanceEnhanced() {
  const today = useMemo(() => istDay(), []);
  const [from, setFrom] = useState(() => monthStart(today));
  const [to, setTo] = useState(today);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!from || !to || from > to) return;
    let live = true;
    setData(null); setError("");
    loadPerformance(from, to).then(v => { if (live) setData(v); }).catch(e => { if (live) setError(e.message || "Couldn't load performance."); });
    return () => { live = false; };
  }, [from, to]);

  const applyQuick = key => {
    if (key === "this-month") { setFrom(monthStart(today)); setTo(today); return; }
    if (key === "last-month") { const r = previousMonth(today); setFrom(r.from); setTo(r.to); return; }
    if (key === "7-days") { setFrom(shiftDay(today, -6)); setTo(today); return; }
    if (key === "30-days") { setFrom(shiftDay(today, -29)); setTo(today); }
  };

  const invalidRange = from && to && from > to;
  const quickButton = (key, label) => <button type="button" onClick={() => applyQuick(key)} style={{ border: "1px solid #DFE5E6", background: "#fff", color: "#526264", borderRadius: 8, padding: "6px 8px", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}>{label}</button>;

  const rangeControls = <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 13, padding: 11 }}>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      <label style={{ minWidth: 0 }}><span style={{ display: "block", fontSize: 9.5, fontWeight: 800, color: C.soft, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".06em" }}>From</span><input aria-label="Performance from date" type="date" value={from} max={to || today} onChange={e => setFrom(e.target.value)} style={{ width: "100%", boxSizing: "border-box", height: 34, border: "1px solid #DFE5E6", borderRadius: 8, background: "#fff", padding: "0 8px", fontSize: 11.5, color: "#334B4C" }} /></label>
      <label style={{ minWidth: 0 }}><span style={{ display: "block", fontSize: 9.5, fontWeight: 800, color: C.soft, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".06em" }}>To</span><input aria-label="Performance to date" type="date" value={to} min={from || undefined} max={today} onChange={e => setTo(e.target.value)} style={{ width: "100%", boxSizing: "border-box", height: 34, border: "1px solid #DFE5E6", borderRadius: 8, background: "#fff", padding: "0 8px", fontSize: 11.5, color: "#334B4C" }} /></label>
    </div>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>{quickButton("this-month", "This Month")}{quickButton("last-month", "Last Month")}{quickButton("7-days", "Last 7 Days")}{quickButton("30-days", "Last 30 Days")}</div>
    {invalidRange && <div style={{ marginTop: 8, fontSize: 10.8, color: C.red }}>From date must be before To date.</div>}
  </div>;

  if (error) return <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{rangeControls}<div style={{ display: "flex", alignItems: "center", gap: 8, padding: 11, border: "1px solid #FED7AA", borderRadius: 10, color: "#9A5A16", background: C.amberSoft, fontSize: 12 }}><AlertTriangle size={15} />{error}</div></div>;

  const header = <>
    <div style={{ padding: "2px 1px 4px" }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".11em", color: C.green, marginBottom: 5 }}>EMPLOYEE PERFORMANCE</div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, color: C.heading }}>My Performance</div>
      <div style={{ fontSize: 12, color: C.soft, marginTop: 3 }}>{rangeLabel(from, to)}</div>
    </div>
    {rangeControls}
  </>;

  if (!data) return <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{header}<div style={{ padding: 18, color: C.soft, fontSize: 13 }}>Loading your performance…</div></div>;

  const won = Number(data.won || 0), wonTarget = Number(data.won_target || 0);
  const wonValue = Number(data.won_value ?? data.sales_value ?? 0), wonValueTarget = Number(data.sales_value_target || 0);
  const totalDeals = Number(data.total_deals ?? data.leads_added ?? 0);
  const winRate = Number(data.win_rate_pct ?? (totalDeals > 0 ? Math.round((won / totalDeals) * 1000) / 10 : 0));
  const followups = Number(data.followups_completed || 0), overdue = Number(data.overdue_followups || 0);
  const attendance = data.attendance || {}, closings = data.day_closing || {};
  const activeDays = Number(attendance.active_days || 0), workingDays = Number(attendance.working_days || 0);
  const attendancePct = Number(attendance.percent || 0), absentDays = Number(attendance.absent_days || 0);
  const closingSubmitted = Number(closings.submitted || 0), closingPending = Number(closings.pending || 0), closingPct = Number(closings.percent || 0);

  let todayText = "Outside selected range", todayTone = "warn";
  if (today >= from && today <= to) {
    todayText = "No attendance activity today";
    if (attendance.not_started_today) todayText = "Not Started Yet";
    else if (attendance.today_started && !attendance.today_ended) { todayText = "Day Active"; todayTone = "good"; }
    else if (attendance.today_started && attendance.today_ended) { todayText = "Day Completed"; todayTone = "good"; }
  }

  const wonValuePct = wonValueTarget > 0 ? pct(wonValue, wonValueTarget) : 0;
  const wonPct = wonTarget > 0 ? pct(won, wonTarget) : 0;

  return <div style={{ display: "flex", flexDirection: "column", gap: 12, color: C.ink }}>
    {header}

    <Panel title="Performance Summary" subtitle="Core deal results for the selected date range" icon={Target}>
      <MetricRow label="Total Deals" value={totalDeals} detail="Deals added in the selected range" />
      <MetricRow label="Won Deals" value={won} detail={wonTarget > 0 ? `${won} of ${wonTarget} prorated target` : "Currently Won deals with canonical Won Date in range"} chip={wonTarget > 0 ? `${wonPct}% target` : null} chipTone={wonPct >= 100 ? "good" : "warn"} progress={won} target={wonTarget} />
      <MetricRow label="Won Value" value={fmtMoney(wonValue)} detail={wonValueTarget > 0 ? `${fmtMoney(wonValue)} of ${fmtMoney(wonValueTarget)} prorated target` : "Current Deal Value of those Won deals"} chip={wonValueTarget > 0 ? `${wonValuePct}% target` : null} chipTone={wonValuePct >= 100 ? "good" : "warn"} progress={wonValue} target={wonValueTarget} />
      <div style={{ borderBottom: 0 }}><MetricRow label="Win Rate" value={`${winRate}%`} detail={`${won} Won Deals from ${totalDeals} Total Deals in this report view`} /></div>
    </Panel>

    <Panel title="Follow-up Health" subtitle="Completed work and overdue items as of the selected range end" icon={ClipboardCheck} accent={overdue > 0 ? C.amber : C.green}>
      <MetricRow label="Completed" value={followups} detail="Follow-ups completed inside the selected range" chip="Completed" chipTone="good" />
      <div style={{ borderBottom: 0 }}><MetricRow label="Overdue" value={overdue} detail={overdue > 0 ? "Follow-ups overdue as of range end" : "No overdue follow-ups as of range end"} chip={overdue > 0 ? "Needs Attention" : "Clear"} chipTone={overdue > 0 ? "risk" : "good"} /></div>
    </Panel>

    <Panel title="Attendance & Discipline" subtitle="Start Day attendance and Day Closing compliance in this range" icon={CalendarDays}>
      <MetricRow label="Attendance" value={`${activeDays} / ${workingDays}`} detail={`${attendancePct}% attendance · ${absentDays} absent`} chip={`${attendancePct}%`} chipTone={attendancePct >= 90 ? "good" : attendancePct >= 75 ? "warn" : "risk"} progress={activeDays} target={workingDays} />
      <MetricRow label="Absent" value={absentDays} detail="Past working days in range with no Start Day" chip={absentDays > 0 ? "Review" : "Clear"} chipTone={absentDays > 0 ? "risk" : "good"} />
      <MetricRow label="Day Closing" value={`${closingSubmitted} / ${activeDays}`} detail={`${closingPct}% submitted · ${closingPending} pending`} chip={closingPending > 0 ? `${closingPending} pending` : "Complete"} chipTone={closingPending > 0 ? "warn" : "good"} progress={closingSubmitted} target={activeDays} progressTone={closingPending > 0 ? C.amber : C.green} />
      <div style={{ padding: "13px 0" }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}><div><div style={{ fontSize: 12.5, fontWeight: 700, color: "#233637" }}>Today</div><div style={{ fontSize: 10.8, color: C.soft, marginTop: 3 }}>Current attendance status</div></div><StatusChip tone={todayTone}>{todayText}</StatusChip></div></div>
    </Panel>

    <div style={{ fontSize: 10.3, color: "#8B9395", lineHeight: 1.45, padding: "0 2px" }}>{attendance.basis}{data.target_basis ? ` Targets: ${data.target_basis}` : ""}</div>
  </div>;
}

let mountedNode = null;
let root = null;
let queued = false;

function findLegacyPerformanceRoot() {
  const heading = [...document.querySelectorAll("div")].find(el => el.childElementCount === 0 && el.textContent?.trim() === "MY PERFORMANCE");
  if (!heading) return null;
  let candidate = heading.parentElement?.parentElement;
  while (candidate && candidate !== document.body) {
    const text = candidate.textContent || "";
    if (text.includes("YOUR MONTH") && text.includes("THIS MONTH")) return candidate;
    candidate = candidate.parentElement;
  }
  return null;
}

function enhance() {
  queued = false;
  const legacy = findLegacyPerformanceRoot();
  if (!legacy) {
    if (mountedNode && !mountedNode.isConnected) { root?.unmount(); root = null; mountedNode = null; }
    return;
  }
  if (legacy.dataset.enhancedPerformance === "1") return;
  legacy.dataset.enhancedPerformance = "1";
  legacy.style.display = "none";
  const host = document.createElement("div");
  host.className = "engage-salesman-performance-v2";
  legacy.insertAdjacentElement("afterend", host);
  mountedNode = host;
  root = createRoot(host);
  root.render(<SalesmanPerformanceEnhanced />);
}

function queue() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(enhance);
}

const observer = new MutationObserver(queue);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("focus", queue);
queue();