import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Trophy, IndianRupee, Target, CheckCircle2, AlertTriangle, Users, ClipboardCheck, CalendarDays } from "lucide-react";
import { api } from "./api.js";

const C = {
  ink: "#172033",
  soft: "#64748B",
  line: "#E6EAF0",
  green: "#16A765",
  greenSoft: "#EAF8F0",
  blue: "#2D6CDF",
  blueSoft: "#EDF3FF",
  purple: "#8B4DD8",
  purpleSoft: "#F5EEFF",
  orange: "#F26A3D",
  orangeSoft: "#FFF2EB",
  red: "#D92D20",
  redSoft: "#FFF0F0",
  amber: "#B7791F",
  amberSoft: "#FFF7E6",
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

function Progress({ value, target, color }) {
  const p = Math.max(0, Math.min(100, pct(value, target)));
  return <div style={{ height: 7, borderRadius: 99, background: "#E8ECF1", overflow: "hidden", marginTop: 9 }}><div style={{ height: "100%", width: `${p}%`, background: color, borderRadius: 99 }} /></div>;
}

function MetricCard({ icon: Icon, label, value, sub, badge, color, soft, progress, target }) {
  return <div style={{ minWidth: 0, border: `1px solid ${C.line}`, borderRadius: 16, padding: 14, background: soft }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
      <div style={{ width: 34, height: 34, borderRadius: 11, display: "grid", placeItems: "center", background: "rgba(255,255,255,.72)", color }}><Icon size={18} /></div>
      {badge != null && <span style={{ fontSize: 11, fontWeight: 850, color, background: "rgba(255,255,255,.72)", borderRadius: 999, padding: "4px 7px" }}>{badge}</span>}
    </div>
    <div style={{ fontSize: 11.5, fontWeight: 750, color: C.soft, marginTop: 10 }}>{label}</div>
    <div style={{ fontSize: 25, lineHeight: 1.05, fontWeight: 900, letterSpacing: "-.5px", color: C.ink, marginTop: 4 }}>{value}</div>
    {sub && <div style={{ fontSize: 11.5, color: C.soft, marginTop: 5 }}>{sub}</div>}
    {progress && Number(target || 0) > 0 && <Progress value={progress} target={target} color={color} />}
  </div>;
}

function Section({ title, icon: Icon, tone, children }) {
  return <section style={{ border: `1px solid ${C.line}`, borderRadius: 18, padding: 14, background: "#fff", boxShadow: "0 1px 3px rgba(16,24,40,.035)" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
      <span style={{ width: 32, height: 32, borderRadius: 11, display: "grid", placeItems: "center", background: tone, color: C.ink }}><Icon size={17} /></span>
      <div style={{ fontSize: 15, fontWeight: 850, color: C.ink }}>{title}</div>
    </div>
    {children}
  </section>;
}

function SalesmanPerformanceEnhanced() {
  const currentMonth = useMemo(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).format(new Date()), []);
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    setData(null); setError("");
    api.myPerformance(`${month}-01`).then(v => { if (live) setData(v); }).catch(e => { if (live) setError(e.message || "Couldn't load performance."); });
    return () => { live = false; };
  }, [month]);

  if (error) return <div style={{ padding: 14, border: `1px solid ${C.line}`, borderRadius: 14, color: C.red, background: C.redSoft, fontSize: 13 }}>{error}</div>;
  if (!data) return <div style={{ padding: 18, color: C.soft, fontSize: 13 }}>Loading your performance…</div>;

  const won = Number(data.won || 0), wonTarget = Number(data.won_target || 0);
  const sales = Number(data.sales_value || 0), salesTarget = Number(data.sales_value_target || 0);
  const conversion = Number(data.lead_to_won_pct || 0);
  const followups = Number(data.followups_completed || 0), overdue = Number(data.overdue_followups || 0);
  const attendance = data.attendance || {};
  const closings = data.day_closing || {};
  const activeDays = Number(attendance.active_days || 0), workingDays = Number(attendance.working_days || 0);
  const attendancePct = Number(attendance.percent || 0), absentDays = Number(attendance.absent_days || 0);
  const closingSubmitted = Number(closings.submitted || 0), closingPending = Number(closings.pending || 0);
  const closingPct = Number(closings.percent || 0);
  const monthLabel = new Date(`${month}-01T12:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  let todayLabel = "";
  let todayTone = C.greenSoft;
  let todayColor = C.green;
  if (attendance.not_started_today) { todayLabel = "Today · Not started yet"; todayTone = C.amberSoft; todayColor = C.amber; }
  else if (attendance.today_started && !attendance.today_ended) { todayLabel = "Today · Present · Day active"; todayTone = C.greenSoft; todayColor = C.green; }
  else if (attendance.today_started && attendance.today_ended) { todayLabel = "Today · Present · Day ended"; }

  return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
      <div><div style={{ fontSize: 18, fontWeight: 900, color: C.ink, letterSpacing: "-.25px" }}>My Performance</div><div style={{ fontSize: 12, color: C.soft, marginTop: 2 }}>{monthLabel}</div></div>
      <input aria-label="Performance month" type="month" value={month} max={currentMonth} onChange={e => setMonth(e.target.value)} style={{ maxWidth: 148, height: 38, border: `1px solid ${C.line}`, borderRadius: 11, background: "#fff", padding: "0 9px", fontSize: 12.5, color: C.ink }} />
    </div>

    <Section title="Sales Performance" icon={Target} tone={C.blueSoft}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}>
        <MetricCard icon={Trophy} label="Won Deals" value={won} sub={wonTarget > 0 ? `Target: ${wonTarget}` : "No target set"} badge={wonTarget > 0 ? `${pct(won, wonTarget)}%` : null} color={C.green} soft={C.greenSoft} progress={won} target={wonTarget} />
        <MetricCard icon={IndianRupee} label="Sales Value" value={fmtMoney(sales)} sub={salesTarget > 0 ? `Target: ${fmtMoney(salesTarget)}` : "No target set"} badge={salesTarget > 0 ? `${pct(sales, salesTarget)}%` : null} color={C.blue} soft={C.blueSoft} progress={sales} target={salesTarget} />
        <MetricCard icon={Target} label="Lead → Won" value={`${conversion}%`} sub={`${won} won from ${Number(data.leads_added || 0)} leads added`} color={C.purple} soft={C.purpleSoft} />
        <MetricCard icon={CheckCircle2} label="Target Progress" value={`${salesTarget > 0 ? pct(sales, salesTarget) : 0}%`} sub={salesTarget > 0 ? `${fmtMoney(sales)} of ${fmtMoney(salesTarget)}` : "Sales target not set"} color={C.orange} soft={C.orangeSoft} />
      </div>
    </Section>

    <Section title="Follow-up Health" icon={ClipboardCheck} tone={C.redSoft}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}>
        <MetricCard icon={CheckCircle2} label="Follow-ups Completed" value={followups} color={C.green} soft={C.greenSoft} />
        <MetricCard icon={AlertTriangle} label="Overdue Follow-ups" value={overdue} color={overdue > 0 ? C.red : C.green} soft={overdue > 0 ? C.redSoft : C.greenSoft} />
      </div>
    </Section>

    <Section title="Attendance & Discipline" icon={CalendarDays} tone={C.amberSoft}>
      {todayLabel && <div style={{ marginBottom: 10, borderRadius: 11, padding: "9px 11px", background: todayTone, color: todayColor, fontSize: 12, fontWeight: 800 }}>{todayLabel}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}>
        <MetricCard icon={Users} label="Attendance" value={`${activeDays} / ${workingDays}`} sub={`${attendancePct}% · ${absentDays} absent${attendance.not_started_today ? " · today not started" : ""}`} badge={`${attendancePct}%`} color={C.green} soft={C.greenSoft} progress={activeDays} target={workingDays} />
        <MetricCard icon={ClipboardCheck} label="Day Closings" value={`${closingSubmitted} / ${activeDays}`} sub={`${closingPct}% · ${closingPending} pending`} badge={`${closingPct}%`} color={closingPending > 0 ? C.orange : C.green} soft={closingPending > 0 ? C.orangeSoft : C.greenSoft} progress={closingSubmitted} target={activeDays} />
      </div>
      {attendance.basis && <div style={{ fontSize: 10.5, color: C.soft, lineHeight: 1.45, marginTop: 9 }}>{attendance.basis}</div>}
    </Section>
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
