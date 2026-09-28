import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { AlertTriangle, CalendarDays, ClipboardCheck, Target } from "lucide-react";
import { api } from "./api.js";

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

  if (error) return <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 11, border: "1px solid #FED7AA", borderRadius: 10, color: "#9A5A16", background: C.amberSoft, fontSize: 12 }}><AlertTriangle size={15} />{error}</div>;
  if (!data) return <div style={{ padding: 18, color: C.soft, fontSize: 13 }}>Loading your performance…</div>;

  const won = Number(data.won || 0), wonTarget = Number(data.won_target || 0);
  const sales = Number(data.sales_value || 0), salesTarget = Number(data.sales_value_target || 0);
  const conversion = Number(data.lead_to_won_pct || 0), leadsAdded = Number(data.leads_added || 0);
  const followups = Number(data.followups_completed || 0), overdue = Number(data.overdue_followups || 0);
  const attendance = data.attendance || {}, closings = data.day_closing || {};
  const activeDays = Number(attendance.active_days || 0), workingDays = Number(attendance.working_days || 0);
  const attendancePct = Number(attendance.percent || 0), absentDays = Number(attendance.absent_days || 0);
  const closingSubmitted = Number(closings.submitted || 0), closingPending = Number(closings.pending || 0), closingPct = Number(closings.percent || 0);
  const monthLabel = new Date(`${month}-01T12:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  let todayText = "No attendance activity today", todayTone = "warn";
  if (attendance.not_started_today) todayText = "Not Started Yet";
  else if (attendance.today_started && !attendance.today_ended) { todayText = "Day Active"; todayTone = "good"; }
  else if (attendance.today_started && attendance.today_ended) { todayText = "Day Completed"; todayTone = "good"; }

  const salesPct = salesTarget > 0 ? pct(sales, salesTarget) : 0;
  const wonPct = wonTarget > 0 ? pct(won, wonTarget) : 0;

  return <div style={{ display: "flex", flexDirection: "column", gap: 12, color: C.ink }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "2px 1px 4px" }}>
      <div>
        <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".11em", color: C.green, marginBottom: 5 }}>EMPLOYEE PERFORMANCE</div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, color: C.heading }}>My Performance</div>
        <div style={{ fontSize: 12, color: C.soft, marginTop: 3 }}>{monthLabel}</div>
      </div>
      <input aria-label="Performance month" type="month" value={month} max={currentMonth} onChange={e => setMonth(e.target.value)} style={{ width: 138, height: 34, border: "1px solid #DFE5E6", borderRadius: 9, background: "#fff", padding: "0 8px", fontSize: 11.5, color: "#334B4C" }} />
    </div>

    <Panel title="Performance Summary" subtitle="Sales result and conversion for the selected month" icon={Target}>
      <MetricRow label="Won Deals" value={won} detail={wonTarget > 0 ? `${won} of ${wonTarget} target` : "No won-deal target set"} chip={wonTarget > 0 ? `${wonPct}% target` : null} chipTone={wonPct >= 100 ? "good" : "warn"} progress={won} target={wonTarget} />
      <MetricRow label="Sales Value" value={fmtMoney(sales)} detail={salesTarget > 0 ? `${fmtMoney(sales)} of ${fmtMoney(salesTarget)} target` : "No sales target set"} chip={salesTarget > 0 ? `${salesPct}% target` : null} chipTone={salesPct >= 100 ? "good" : "warn"} progress={sales} target={salesTarget} />
      <MetricRow label="Lead → Won" value={`${conversion}%`} detail={`${won} won from ${leadsAdded} leads added`} />
      <div style={{ borderBottom: 0 }}><MetricRow label="Target Progress" value={`${salesPct}%`} detail={salesTarget > 0 ? `${fmtMoney(Math.max(0, salesTarget - sales))} remaining` : "Sales target not set"} chip={salesPct >= 100 ? "Achieved" : "In Progress"} chipTone={salesPct >= 100 ? "good" : "warn"} /></div>
    </Panel>

    <Panel title="Follow-up Health" subtitle="Completed work and items needing attention" icon={ClipboardCheck} accent={overdue > 0 ? C.amber : C.green}>
      <MetricRow label="Completed" value={followups} detail="Follow-ups completed this month" chip="Completed" chipTone="good" />
      <div style={{ borderBottom: 0 }}><MetricRow label="Overdue" value={overdue} detail={overdue > 0 ? "Follow-ups currently overdue" : "No overdue follow-ups"} chip={overdue > 0 ? "Needs Attention" : "Clear"} chipTone={overdue > 0 ? "risk" : "good"} /></div>
    </Panel>

    <Panel title="Attendance & Discipline" subtitle="Start Day attendance and Day Closing compliance" icon={CalendarDays}>
      <MetricRow label="Attendance" value={`${activeDays} / ${workingDays}`} detail={`${attendancePct}% attendance · ${absentDays} absent`} chip={`${attendancePct}%`} chipTone={attendancePct >= 90 ? "good" : attendancePct >= 75 ? "warn" : "risk"} progress={activeDays} target={workingDays} />
      <MetricRow label="Absent" value={absentDays} detail="Past working days with no Start Day" chip={absentDays > 0 ? "Review" : "Clear"} chipTone={absentDays > 0 ? "risk" : "good"} />
      <MetricRow label="Day Closing" value={`${closingSubmitted} / ${activeDays}`} detail={`${closingPct}% submitted · ${closingPending} pending`} chip={closingPending > 0 ? `${closingPending} pending` : "Complete"} chipTone={closingPending > 0 ? "warn" : "good"} progress={closingSubmitted} target={activeDays} progressTone={closingPending > 0 ? C.amber : C.green} />
      <div style={{ padding: "13px 0" }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}><div><div style={{ fontSize: 12.5, fontWeight: 700, color: "#233637" }}>Today</div><div style={{ fontSize: 10.8, color: C.soft, marginTop: 3 }}>Current attendance status</div></div><StatusChip tone={todayTone}>{todayText}</StatusChip></div></div>
    </Panel>

    {attendance.basis && <div style={{ fontSize: 10.3, color: "#8B9395", lineHeight: 1.45, padding: "0 2px" }}>{attendance.basis}</div>}
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
