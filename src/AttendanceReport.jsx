import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Plus,
  Settings2,
  Trash2,
  UsersRound,
} from "lucide-react";
import { api } from "./api.js";
import { attendanceApi } from "./attendanceApi.js";
import { closingComplianceForDay } from "./attendanceClosingCompliance.js";

const C = {
  ink: "#1A1D23",
  heading: "#183738",
  soft: "#6B7280",
  line: "#E4E8EB",
  lineSoft: "#EDF0F2",
  card: "#FFFFFF",
  green: "#145C5D",
  green2: "#12805C",
  greenSoft: "#EDF7F5",
  amber: "#A15C0A",
  amberSoft: "#FFF7ED",
  red: "#AA3428",
  redSoft: "#FDE9E7",
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EXCEPTION_LABELS = {
  holiday: "Holiday",
  leave: "Approved Leave",
  weekly_off: "Weekly Off",
  working_day: "Special Working Day",
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

function dayString(value) {
  return value ? String(value).slice(0, 10) : "";
}

function shiftDay(day, delta) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function monthStart(day) {
  return `${day.slice(0, 7)}-01`;
}

function monthEnd(day) {
  const [year, month] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0, 12)).toISOString().slice(0, 10);
}

function previousMonth(day) {
  const [year, month] = day.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 2, 1, 12)).toISOString().slice(0, 10);
  return { from: first, to: monthEnd(first) };
}

function weekStart(day) {
  const d = new Date(`${day}T12:00:00Z`);
  const dow = d.getUTCDay();
  return shiftDay(day, -(dow === 0 ? 6 : dow - 1));
}

function dayOfWeek(day) {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

function rangeDays(from, to) {
  if (!from || !to || from > to) return [];
  const days = [];
  for (let current = from; current <= to; current = shiftDay(current, 1)) days.push(current);
  return days;
}

function fmtDate(day) {
  return day
    ? new Date(`${day}T12:00:00`).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
}

function fmtShortDate(day) {
  return new Date(`${day}T12:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

function fmtTime(value) {
  return value
    ? new Date(value).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      })
    : "—";
}

function fmtDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const mins = Math.floor(ms / 60000);
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function daysLabel(days = []) {
  return [...days].sort((a, b) => a - b).map((d) => DAY_LABELS[d]).join(", ");
}

async function loadAllClosingReports(from, to, employee) {
  const rows = [];
  let offset = 0;
  for (let page = 0; page < 40; page += 1) {
    const params = { from, to, offset };
    if (employee) params.employee = employee;
    const result = await api.closingReports(params);
    rows.push(...(result.reports || []));
    if (!result.hasMore) break;
    offset += 50;
  }
  return rows;
}

async function loadAttendanceReportData(from, to, employee) {
  const params = { from, to };
  if (employee) params.employee = employee;

  const rows = await loadAllClosingReports(from, to, employee);
  const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];
  const [settings, policyPairs] = await Promise.all([
    attendanceApi.settings(params),
    Promise.all(userIds.map(async (userId) => [userId, await attendanceApi.permissions(userId)])),
  ]);

  return {
    rows,
    settings: {
      ...settings,
      closingPolicies: Object.fromEntries(policyPairs),
    },
  };
}

function Pill({ children, tone = "gray" }) {
  const tones = {
    green: [C.greenSoft, C.green2],
    amber: [C.amberSoft, C.amber],
    red: [C.redSoft, C.red],
    gray: ["#F2F4F7", "#667085"],
  };
  const [background, color] = tones[tone] || tones.gray;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", padding:"4px 8px", borderRadius:999, background, color, fontSize:10.5, fontWeight:800, whiteSpace:"nowrap" }}>
      {children}
    </span>
  );
}

function SummaryRow({ label, value, detail, tone = "green", last = false }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) auto", gap:12, alignItems:"center", padding:"12px 0", borderBottom:last ? "none" : `1px solid ${C.lineSoft}` }}>
      <div>
        <div style={{ fontSize:12.5, fontWeight:750, color:"#233637" }}>{label}</div>
        {detail && <div style={{ fontSize:10.7, color:C.soft, marginTop:3 }}>{detail}</div>}
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <strong style={{ fontFamily:"'Space Grotesk', sans-serif", fontSize:18, color:C.heading }}>{value}</strong>
        <Pill tone={tone}>{tone === "red" ? "Review" : tone === "amber" ? "Attention" : "Good"}</Pill>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, icon: Icon, children }) {
  return (
    <section style={{ background:C.card, border:`1px solid ${C.line}`, borderRadius:15, overflow:"hidden" }}>
      <div style={{ display:"flex", alignItems:"center", gap:9, padding:"13px 14px", borderBottom:`1px solid ${C.lineSoft}` }}>
        <span style={{ width:30, height:30, borderRadius:9, display:"grid", placeItems:"center", background:"#F2F6F5", color:C.green }}><Icon size={15}/></span>
        <div>
          <div style={{ fontFamily:"'Space Grotesk', sans-serif", fontSize:14.5, fontWeight:750, color:"#223A3B" }}>{title}</div>
          {subtitle && <div style={{ fontSize:10.5, color:"#7A8385", marginTop:2 }}>{subtitle}</div>}
        </div>
      </div>
      <div style={{ padding:"0 14px" }}>{children}</div>
    </section>
  );
}

function DayPicker({ value, onChange }) {
  const selected = new Set(value || []);
  const toggle = (day) => {
    const next = new Set(selected);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    if (!next.size) return;
    onChange([...next].sort((a, b) => a - b));
  };
  return (
    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
      {DAY_LABELS.map((label, day) => {
        const on = selected.has(day);
        return (
          <button key={label} type="button" onClick={() => toggle(day)} style={{ height:31, minWidth:42, padding:"0 8px", border:`1px solid ${on ? "#AFCFC8" : C.line}`, borderRadius:8, background:on ? C.greenSoft : "#fff", color:on ? C.green : C.soft, fontSize:10.8, fontWeight:800, cursor:"pointer" }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

function dayMetrics(sessions, day, now, today) {
  const sorted = sessions.slice().sort((a, b) => new Date(a.start_day_at || 0) - new Date(b.start_day_at || 0));
  const firstStart = sorted[0]?.start_day_at || null;
  const hasOpen = sorted.some((s) => s.start_day_at && !s.end_day_at);
  const lastEnd = hasOpen ? null : (sorted[sorted.length - 1]?.end_day_at || null);
  let durationMs = 0;
  for (const session of sorted) {
    if (!session.start_day_at) continue;
    const start = new Date(session.start_day_at).getTime();
    const end = session.end_day_at ? new Date(session.end_day_at).getTime() : (day === today ? now : start);
    durationMs += Math.max(0, end - start);
  }
  const statuses = sorted.map((s) => s.status).filter(Boolean);
  return { firstStart, lastEnd, hasOpen, durationMs, statuses, sessionCount:sorted.length };
}

function scheduleFor(userId, calendar) {
  const override = calendar?.employeeSchedules?.find((item) => item.userId === userId);
  return override?.workingDays || calendar?.company?.workingDays || [];
}

function exceptionsFor(day, userId, calendar) {
  const items = calendar?.exceptions || [];
  return {
    global: items.find((item) => !item.userId && item.day === day) || null,
    employee: items.find((item) => item.userId === userId && item.day === day) || null,
  };
}

function calendarState(day, userId, calendar) {
  let working = scheduleFor(userId, calendar).includes(dayOfWeek(day));
  const { global, employee } = exceptionsFor(day, userId, calendar);
  for (const exception of [global, employee]) {
    if (!exception) continue;
    working = exception.kind === "working_day";
  }
  return { working, exception:employee || global || null };
}

export default function AttendanceReport({ salesmen = [] }) {
  const today = useMemo(istDay, []);
  const [from, setFrom] = useState(monthStart(today));
  const [to, setTo] = useState(today);
  const [employee, setEmployee] = useState("");
  const [status, setStatus] = useState("all");
  const [raw, setRaw] = useState([]);
  const [calendar, setCalendar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState("");
  const [now, setNow] = useState(Date.now());

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [companyDays, setCompanyDays] = useState([]);
  const [scheduleEmployee, setScheduleEmployee] = useState("");
  const [employeeMode, setEmployeeMode] = useState("inherit");
  const [employeeDays, setEmployeeDays] = useState([]);
  const [exceptionDay, setExceptionDay] = useState(today);
  const [exceptionEmployee, setExceptionEmployee] = useState("");
  const [exceptionKind, setExceptionKind] = useState("holiday");
  const [exceptionLabel, setExceptionLabel] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  async function loadReport() {
    if (!from || !to || from > to) return;
    setLoading(true);
    setError("");
    try {
      const { rows, settings } = await loadAttendanceReportData(from, to, employee);
      setRaw(rows);
      setCalendar(settings);
      setCompanyDays(settings.company.workingDays);
    } catch (err) {
      setRaw([]);
      setCalendar(null);
      setError(err.message || "Could not load attendance report.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    if (!from || !to || from > to) return undefined;
    setLoading(true);
    setError("");
    loadAttendanceReportData(from, to, employee)
      .then(({ rows, settings }) => {
        if (cancelled) return;
        setRaw(rows);
        setCalendar(settings);
        setCompanyDays(settings.company.workingDays);
      })
      .catch((err) => {
        if (cancelled) return;
        setRaw([]);
        setCalendar(null);
        setError(err.message || "Could not load attendance report.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to, employee]);

  useEffect(() => {
    if (!calendar || !scheduleEmployee) {
      setEmployeeMode("inherit");
      setEmployeeDays(calendar?.company?.workingDays || []);
      return;
    }
    const override = calendar.employeeSchedules.find((item) => item.userId === scheduleEmployee);
    setEmployeeMode(override ? "custom" : "inherit");
    setEmployeeDays(override?.workingDays || calendar.company.workingDays);
  }, [calendar, scheduleEmployee]);

  const effectiveTo = to > today ? today : to;
  const selectedDays = useMemo(() => rangeDays(from, effectiveTo), [from, effectiveTo]);

  const rows = useMemo(() => {
    if (!calendar) return [];
    const people = new Map();
    for (const row of raw) {
      if (!people.has(row.user_id)) people.set(row.user_id, { userId:row.user_id, name:row.full_name || "Employee", sessions:[] });
      if (row.attendance_id) people.get(row.user_id).sessions.push({ ...row, day:dayString(row.day) });
    }

    return [...people.values()].map((person) => {
      const closingPolicy = calendar.closingPolicies?.[person.userId];
      if (!closingPolicy || typeof closingPolicy.require_closing !== "boolean") {
        throw new Error(`Day Closing policy is unavailable for ${person.name}.`);
      }

      const byDay = new Map();
      for (const session of person.sessions) {
        if (!byDay.has(session.day)) byDay.set(session.day, []);
        byDay.get(session.day).push(session);
      }

      const workedDates = [...byDay.keys()].filter(Boolean).sort();
      const expectedDates = selectedDays.filter((day) => calendarState(day, person.userId, calendar).working);
      const expectedSet = new Set(expectedDates);
      const pastExpectedDates = expectedDates.filter((day) => day < today);
      const pastPresent = workedDates.filter((day) => day < today && expectedSet.has(day)).length;
      const pastAbsent = Math.max(0, pastExpectedDates.length - pastPresent);
      const todayWorking = expectedSet.has(today) && today >= from && today <= effectiveTo;
      const todayPresent = todayWorking && byDay.has(today);
      const attendanceDenominator = pastExpectedDates.length + (todayWorking ? 1 : 0);
      const attendanceNumerator = pastPresent + (todayPresent ? 1 : 0);
      const attendancePct = attendanceDenominator ? Math.round(attendanceNumerator / attendanceDenominator * 1000) / 10 : 0;
      const notStartedToday = todayWorking && !todayPresent;

      let closingDone = 0;
      let closingRequiredDays = 0;
      let totalDuration = 0;
      const details = [];
      const exceptionDates = (calendar.exceptions || [])
        .filter((item) => item.day >= from && item.day <= effectiveTo && (!item.userId || item.userId === person.userId))
        .map((item) => item.day);
      const detailDays = new Set([...expectedDates, ...workedDates, ...exceptionDates]);

      for (const day of [...detailDays].sort().reverse()) {
        const sessions = byDay.get(day) || [];
        const policy = calendarState(day, person.userId, calendar);
        const metrics = dayMetrics(sessions, day, now, today);
        const closing = closingComplianceForDay({
          hasSessions:sessions.length > 0,
          statuses:metrics.statuses,
          requireClosing:closingPolicy.require_closing,
        });
        if (closing.required) closingRequiredDays += 1;
        if (closing.completed) closingDone += 1;
        totalDuration += metrics.durationMs;

        let state = "Off Day";
        let tone = "gray";
        if (sessions.length) {
          state = metrics.hasOpen ? "Day Open" : "Present";
          tone = metrics.hasOpen ? "amber" : "green";
        } else if (policy.exception && policy.exception.kind !== "working_day") {
          state = EXCEPTION_LABELS[policy.exception.kind] || "Off Day";
          tone = "gray";
        } else if (day === today && policy.working) {
          state = "Not Started";
          tone = "amber";
        } else if (policy.working) {
          state = "Absent";
          tone = "red";
        }

        details.push({ day, sessions, ...metrics, closingRequired:closing.required, closingDone:closing.completed, state, tone, policy });
      }

      const workedDays = workedDates.length;
      const closingPending = Math.max(0, closingRequiredDays - closingDone);
      return {
        ...person,
        workedDays,
        workingDays:attendanceDenominator,
        presentWorkingDays:attendanceNumerator,
        absentDays:pastAbsent,
        notStartedToday,
        attendancePct,
        closingDone,
        closingRequiredDays,
        closingPending,
        totalDuration,
        details,
      };
    });
  }, [raw, calendar, selectedDays, from, effectiveTo, today, now]);

  const filtered = useMemo(() => rows.filter((row) => {
    if (status === "all") return true;
    if (status === "worked") return row.workedDays > 0;
    if (status === "absent") return row.absentDays > 0;
    if (status === "closing") return row.closingPending > 0;
    return true;
  }), [rows, status]);

  const summary = useMemo(() => rows.reduce((acc, row) => ({
    worked:acc.worked + row.workedDays,
    working:acc.working + row.workingDays,
    present:acc.present + row.presentWorkingDays,
    absent:acc.absent + row.absentDays,
    notStartedToday:acc.notStartedToday + (row.notStartedToday ? 1 : 0),
    closingDone:acc.closingDone + row.closingDone,
    closingRequired:acc.closingRequired + row.closingRequiredDays,
    closingPending:acc.closingPending + row.closingPending,
  }), { worked:0, working:0, present:0, absent:0, notStartedToday:0, closingDone:0, closingRequired:0, closingPending:0 }), [rows]);

  const summaryPct = summary.working ? Math.round(summary.present / summary.working * 1000) / 10 : 0;

  function setPreset(kind) {
    if (kind === "today") { setFrom(today); setTo(today); }
    if (kind === "week") { setFrom(weekStart(today)); setTo(today); }
    if (kind === "month") { setFrom(monthStart(today)); setTo(today); }
    if (kind === "last") { const previous = previousMonth(today); setFrom(previous.from); setTo(previous.to); }
  }

  async function saveCompanySchedule() {
    if (!calendar) return;
    setSettingsSaving(true);
    setSettingsMessage("");
    try {
      await attendanceApi.saveCompany({ workingDays:companyDays, version:calendar.company.version });
      setSettingsMessage("Company working week saved.");
      await loadReport();
    } catch (err) {
      setSettingsMessage(err.message || "Could not save company schedule.");
    } finally {
      setSettingsSaving(false);
    }
  }

  async function saveEmployeeSchedule() {
    if (!scheduleEmployee || !calendar) return;
    setSettingsSaving(true);
    setSettingsMessage("");
    try {
      const existing = calendar.employeeSchedules.find((item) => item.userId === scheduleEmployee);
      if (employeeMode === "inherit") {
        await attendanceApi.saveEmployee(scheduleEmployee, { inherit:true });
      } else {
        await attendanceApi.saveEmployee(scheduleEmployee, { workingDays:employeeDays, version:existing?.version ?? null });
      }
      setSettingsMessage("Employee schedule saved.");
      await loadReport();
    } catch (err) {
      setSettingsMessage(err.message || "Could not save employee schedule.");
    } finally {
      setSettingsSaving(false);
    }
  }

  async function addException() {
    if (!exceptionDay) return;
    setSettingsSaving(true);
    setSettingsMessage("");
    try {
      await attendanceApi.saveException({
        userId:exceptionEmployee || null,
        day:exceptionDay,
        kind:exceptionKind,
        label:exceptionLabel.trim(),
      });
      setExceptionLabel("");
      setSettingsMessage("Calendar exception saved.");
      await loadReport();
    } catch (err) {
      setSettingsMessage(err.message || "Could not save calendar exception.");
    } finally {
      setSettingsSaving(false);
    }
  }

  async function removeException(id) {
    setSettingsSaving(true);
    setSettingsMessage("");
    try {
      await attendanceApi.deleteException(id);
      setSettingsMessage("Calendar exception removed.");
      await loadReport();
    } catch (err) {
      setSettingsMessage(err.message || "Could not remove calendar exception.");
    } finally {
      setSettingsSaving(false);
    }
  }

  const rangeLabel = from === to ? fmtDate(from) : `${fmtDate(from)} → ${fmtDate(to)}`;
  const currentEmployeeOverride = calendar?.employeeSchedules?.find((item) => item.userId === scheduleEmployee);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12, color:C.ink }}>
      <style>{`
        @media(max-width:760px){
          .attendance-summary-grid{grid-template-columns:1fr!important}
          .attendance-settings-grid{grid-template-columns:1fr!important}
          .attendance-employee-row{grid-template-columns:minmax(140px,1fr) auto 18px!important}
          .attendance-employee-row .attendance-extra{display:none!important}
          .attendance-day-row{grid-template-columns:68px 92px minmax(135px,1fr)!important}
          .attendance-day-row .attendance-closing-detail{display:none!important}
        }
      `}</style>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, flexWrap:"wrap" }}>
        <div>
          <div style={{ fontSize:10.5, fontWeight:800, letterSpacing:".11em", color:C.green, marginBottom:5 }}>ATTENDANCE</div>
          <div style={{ fontFamily:"'Space Grotesk', sans-serif", fontSize:22, fontWeight:750, color:C.heading }}>Attendance Report</div>
          <div style={{ fontSize:12, color:C.soft, marginTop:3 }}>{rangeLabel}</div>
        </div>
        <div style={{ display:"flex", gap:7, flexWrap:"wrap", justifyContent:"flex-end" }}>
          {[['today','Today'],['week','This Week'],['month','This Month'],['last','Last Month']].map(([key, label]) => (
            <button key={key} onClick={() => setPreset(key)} style={{ height:34, padding:"0 10px", border:`1px solid ${C.line}`, borderRadius:9, background:"#fff", color:"#415657", fontSize:11.5, fontWeight:700, cursor:"pointer" }}>{label}</button>
          ))}
          <button onClick={() => setSettingsOpen((value) => !value)} style={{ height:34, padding:"0 10px", display:"inline-flex", alignItems:"center", gap:6, border:`1px solid ${settingsOpen ? "#B8D4CF" : C.line}`, borderRadius:9, background:settingsOpen ? C.greenSoft : "#fff", color:C.green, fontSize:11.5, fontWeight:750, cursor:"pointer" }}>
            <Settings2 size={13}/> Attendance Settings
          </button>
        </div>
      </div>

      <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center", padding:"10px 12px", background:"#FBFCFC", border:`1px solid ${C.line}`, borderRadius:12 }}>
        <label style={{ fontSize:10.5, fontWeight:800, color:C.soft }}>FROM <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} style={{ marginLeft:6, height:34, border:`1px solid ${C.line}`, borderRadius:8, padding:"0 8px", background:"#fff", color:C.ink, fontSize:11.5 }}/></label>
        <label style={{ fontSize:10.5, fontWeight:800, color:C.soft }}>TO <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} style={{ marginLeft:6, height:34, border:`1px solid ${C.line}`, borderRadius:8, padding:"0 8px", background:"#fff", color:C.ink, fontSize:11.5 }}/></label>
        <select value={employee} onChange={(e) => setEmployee(e.target.value)} style={{ height:34, minWidth:170, border:`1px solid ${C.line}`, borderRadius:8, padding:"0 28px 0 9px", background:"#fff", color:C.ink, fontSize:11.5 }}>
          <option value="">All Employees</option>
          {salesmen.map((salesman) => <option key={salesman.id} value={salesman.id}>{salesman.name}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ height:34, minWidth:150, border:`1px solid ${C.line}`, borderRadius:8, padding:"0 28px 0 9px", background:"#fff", color:C.ink, fontSize:11.5 }}>
          <option value="all">All Status</option>
          <option value="worked">Worked</option>
          <option value="absent">Has Absence</option>
          <option value="closing">Closing Pending</option>
        </select>
      </div>

      {from > to && <div style={{ padding:"11px 12px", borderRadius:10, background:C.redSoft, color:C.red, fontSize:12 }}>From date must be before To date.</div>}
      {error && <div style={{ padding:"11px 12px", borderRadius:10, background:C.redSoft, color:C.red, fontSize:12 }}>{error}</div>}

      {settingsOpen && calendar && (
        <section style={{ background:C.card, border:`1px solid ${C.line}`, borderRadius:15, overflow:"hidden" }}>
          <div style={{ display:"flex", alignItems:"center", gap:9, padding:"13px 14px", borderBottom:`1px solid ${C.lineSoft}` }}>
            <span style={{ width:30, height:30, borderRadius:9, display:"grid", placeItems:"center", background:C.greenSoft, color:C.green }}><Settings2 size={15}/></span>
            <div>
              <div style={{ fontFamily:"'Space Grotesk', sans-serif", fontSize:14.5, fontWeight:750, color:"#223A3B" }}>Attendance Settings</div>
              <div style={{ fontSize:10.5, color:C.soft, marginTop:2 }}>Company week, employee overrides and calendar exceptions</div>
            </div>
          </div>

          <div className="attendance-settings-grid" style={{ display:"grid", gridTemplateColumns:"repeat(3,minmax(0,1fr))", gap:0 }}>
            <div style={{ padding:14, borderRight:`1px solid ${C.lineSoft}` }}>
              <div style={{ fontSize:12.5, fontWeight:800, color:C.heading }}>Company working week</div>
              <div style={{ fontSize:10.5, color:C.soft, margin:"3px 0 11px" }}>Default schedule for employees without an override.</div>
              <DayPicker value={companyDays} onChange={setCompanyDays}/>
              <button disabled={settingsSaving} onClick={saveCompanySchedule} style={{ marginTop:12, height:32, padding:"0 11px", border:0, borderRadius:8, background:C.green, color:"#fff", fontSize:11, fontWeight:800, cursor:settingsSaving ? "default" : "pointer", opacity:settingsSaving ? .65 : 1 }}>Save company week</button>
            </div>

            <div style={{ padding:14, borderRight:`1px solid ${C.lineSoft}` }}>
              <div style={{ fontSize:12.5, fontWeight:800, color:C.heading }}>Employee schedule</div>
              <div style={{ fontSize:10.5, color:C.soft, margin:"3px 0 10px" }}>Override the company week only when someone works a different pattern.</div>
              <select value={scheduleEmployee} onChange={(e) => setScheduleEmployee(e.target.value)} style={{ width:"100%", height:34, border:`1px solid ${C.line}`, borderRadius:8, padding:"0 28px 0 9px", background:"#fff", fontSize:11.5 }}>
                <option value="">Select employee</option>
                {salesmen.map((salesman) => <option key={salesman.id} value={salesman.id}>{salesman.name}</option>)}
              </select>
              {scheduleEmployee && <>
                <div style={{ display:"flex", gap:6, margin:"9px 0" }}>
                  <button onClick={() => { setEmployeeMode("inherit"); setEmployeeDays(calendar.company.workingDays); }} style={{ height:30, padding:"0 9px", border:`1px solid ${employeeMode === "inherit" ? "#B8D4CF" : C.line}`, borderRadius:8, background:employeeMode === "inherit" ? C.greenSoft : "#fff", color:employeeMode === "inherit" ? C.green : C.soft, fontSize:10.5, fontWeight:800, cursor:"pointer" }}>Use company</button>
                  <button onClick={() => setEmployeeMode("custom")} style={{ height:30, padding:"0 9px", border:`1px solid ${employeeMode === "custom" ? "#B8D4CF" : C.line}`, borderRadius:8, background:employeeMode === "custom" ? C.greenSoft : "#fff", color:employeeMode === "custom" ? C.green : C.soft, fontSize:10.5, fontWeight:800, cursor:"pointer" }}>Custom</button>
                </div>
                {employeeMode === "custom" && <DayPicker value={employeeDays} onChange={setEmployeeDays}/>} 
                <div style={{ fontSize:10, color:C.soft, marginTop:8 }}>{currentEmployeeOverride ? `Current override: ${daysLabel(currentEmployeeOverride.workingDays)}` : `Currently inherits: ${daysLabel(calendar.company.workingDays)}`}</div>
                <button disabled={settingsSaving} onClick={saveEmployeeSchedule} style={{ marginTop:10, height:32, padding:"0 11px", border:0, borderRadius:8, background:C.green, color:"#fff", fontSize:11, fontWeight:800, cursor:settingsSaving ? "default" : "pointer", opacity:settingsSaving ? .65 : 1 }}>Save employee schedule</button>
              </>}
            </div>

            <div style={{ padding:14 }}>
              <div style={{ fontSize:12.5, fontWeight:800, color:C.heading }}>Calendar exception</div>
              <div style={{ fontSize:10.5, color:C.soft, margin:"3px 0 10px" }}>Holiday, approved leave, weekly off or a special working day.</div>
              <div style={{ display:"grid", gap:7 }}>
                <input type="date" value={exceptionDay} onChange={(e) => setExceptionDay(e.target.value)} style={{ height:34, border:`1px solid ${C.line}`, borderRadius:8, padding:"0 9px", fontSize:11.5 }}/>
                <select value={exceptionEmployee} onChange={(e) => setExceptionEmployee(e.target.value)} style={{ height:34, border:`1px solid ${C.line}`, borderRadius:8, padding:"0 28px 0 9px", background:"#fff", fontSize:11.5 }}>
                  <option value="">Company-wide</option>
                  {salesmen.map((salesman) => <option key={salesman.id} value={salesman.id}>{salesman.name}</option>)}
                </select>
                <select value={exceptionKind} onChange={(e) => setExceptionKind(e.target.value)} style={{ height:34, border:`1px solid ${C.line}`, borderRadius:8, padding:"0 28px 0 9px", background:"#fff", fontSize:11.5 }}>
                  <option value="holiday">Holiday</option>
                  <option value="leave">Approved Leave</option>
                  <option value="weekly_off">Weekly Off</option>
                  <option value="working_day">Special Working Day</option>
                </select>
                <input value={exceptionLabel} maxLength={120} onChange={(e) => setExceptionLabel(e.target.value)} placeholder="Note / holiday name (optional)" style={{ height:34, border:`1px solid ${C.line}`, borderRadius:8, padding:"0 9px", fontSize:11.5 }}/>
                <button disabled={settingsSaving} onClick={addException} style={{ height:32, display:"inline-flex", alignItems:"center", justifyContent:"center", gap:5, border:0, borderRadius:8, background:C.green, color:"#fff", fontSize:11, fontWeight:800, cursor:settingsSaving ? "default" : "pointer", opacity:settingsSaving ? .65 : 1 }}><Plus size={12}/> Save exception</button>
              </div>
            </div>
          </div>

          {(calendar.exceptions || []).length > 0 && <div style={{ borderTop:`1px solid ${C.lineSoft}`, padding:"9px 14px" }}>
            <div style={{ fontSize:10.5, fontWeight:800, color:C.soft, marginBottom:6 }}>EXCEPTIONS IN SELECTED RANGE</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {calendar.exceptions.map((item) => (
                <span key={item.id} style={{ display:"inline-flex", alignItems:"center", gap:6, border:`1px solid ${C.line}`, borderRadius:999, padding:"5px 7px 5px 9px", background:"#FBFCFC", fontSize:10.5, color:"#415657" }}>
                  {fmtShortDate(item.day)} · {item.employeeName || "Company"} · {EXCEPTION_LABELS[item.kind] || item.kind}{item.label ? ` · ${item.label}` : ""}
                  <button onClick={() => removeException(item.id)} aria-label="Remove exception" style={{ border:0, background:"transparent", padding:0, display:"grid", placeItems:"center", color:"#8A9495", cursor:"pointer" }}><Trash2 size={11}/></button>
                </span>
              ))}
            </div>
          </div>}

          {settingsMessage && <div style={{ borderTop:`1px solid ${C.lineSoft}`, padding:"8px 14px", fontSize:10.8, color:settingsMessage.toLowerCase().includes("could not") || settingsMessage.toLowerCase().includes("changed") ? C.red : C.green }}>{settingsMessage}</div>}
        </section>
      )}

      <div className="attendance-summary-grid" style={{ display:"grid", gridTemplateColumns:"repeat(2,minmax(0,1fr))", gap:12 }}>
        <Panel title="Attendance Summary" subtitle={employee ? "Selected employee" : "Team totals for the selected range"} icon={UsersRound}>
          <SummaryRow label="Worked Days" value={summary.worked} detail="Unique days with Start Day" tone="green"/>
          <SummaryRow label="Working Days" value={summary.working} detail="Expected working days through today" tone="green"/>
          <SummaryRow label="Absent Days" value={summary.absent} detail="Past expected working days with no Start Day" tone={summary.absent ? "red" : "green"}/>
          {summary.notStartedToday > 0 && <SummaryRow label="Not Started Today" value={summary.notStartedToday} detail="Scheduled today but Start Day is not recorded yet" tone="amber"/>}
          <SummaryRow label="Attendance" value={`${summaryPct}%`} detail="Present scheduled days ÷ expected working days" tone={summaryPct >= 90 ? "green" : summaryPct >= 75 ? "amber" : "red"} last/>
        </Panel>
        <Panel title="Day Closing" subtitle="Closing compliance on days actually worked" icon={ClipboardCheck}>
          <SummaryRow label="Completed" value={`${summary.closingDone} / ${summary.closingRequired}`} detail="Required worked days completed by submitted or approved skipped closing" tone={summary.closingPending ? "amber" : "green"}/>
          <SummaryRow label="Pending" value={summary.closingPending} detail="Required worked days without completed closing" tone={summary.closingPending ? "amber" : "green"} last/>
        </Panel>
      </div>

      <section style={{ background:C.card, border:`1px solid ${C.line}`, borderRadius:15, overflow:"hidden" }}>
        <div style={{ display:"flex", alignItems:"center", gap:9, padding:"13px 14px", borderBottom:`1px solid ${C.lineSoft}` }}>
          <span style={{ width:30, height:30, borderRadius:9, display:"grid", placeItems:"center", background:"#F2F6F5", color:C.green }}><CalendarDays size={15}/></span>
          <div>
            <div style={{ fontFamily:"'Space Grotesk', sans-serif", fontSize:14.5, fontWeight:750, color:"#223A3B" }}>Employee Attendance</div>
            <div style={{ fontSize:10.5, color:"#7A8385", marginTop:2 }}>Worked days, scheduled days, absences and closing status</div>
          </div>
        </div>

        {loading ? (
          <div style={{ padding:30, textAlign:"center", color:C.soft, fontSize:12.5 }}>Loading attendance…</div>
        ) : filtered.length ? filtered.map((row) => {
          const open = expanded === row.userId;
          return (
            <div key={row.userId} style={{ borderBottom:`1px solid ${C.lineSoft}` }}>
              <button className="attendance-employee-row" onClick={() => setExpanded(open ? "" : row.userId)} style={{ width:"100%", border:0, background:"#fff", padding:"12px 14px", cursor:"pointer", textAlign:"left", display:"grid", gridTemplateColumns:"minmax(160px,1fr) auto auto auto 18px", gap:14, alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:12.8, fontWeight:800, color:"#233637" }}>{row.name}</div>
                  <div style={{ fontSize:10.6, color:C.soft, marginTop:3 }}>{row.workedDays} worked · {row.workingDays} expected · {fmtDuration(row.totalDuration)}</div>
                </div>
                <div className="attendance-extra" style={{ textAlign:"right" }}>
                  <div style={{ fontSize:10, color:C.soft }}>Attendance</div>
                  <div style={{ fontSize:13, fontWeight:800, color:C.heading, marginTop:2 }}>{row.attendancePct}%</div>
                </div>
                <span className="attendance-extra"><Pill tone={row.notStartedToday ? "amber" : row.absentDays ? "red" : "green"}>{row.notStartedToday ? "Not started" : `${row.absentDays} absent`}</Pill></span>
                <span className="attendance-extra"><Pill tone={row.closingPending ? "amber" : "green"}>{row.closingRequiredDays ? `${row.closingDone}/${row.closingRequiredDays} closing` : "Closing not required"}</Pill></span>
                {open ? <ChevronDown size={15} color="#7B8788"/> : <ChevronRight size={15} color="#A4AEAE"/>}
              </button>

              {open && <div style={{ padding:"0 14px 13px", background:"#FCFDFD" }}>
                <div style={{ fontSize:10.2, color:C.soft, margin:"0 0 7px" }}>Schedule: {daysLabel(scheduleFor(row.userId, calendar))}</div>
                <div style={{ border:`1px solid ${C.lineSoft}`, borderRadius:10, overflow:"hidden" }}>
                  {row.details.map((detail, index) => (
                    <div className="attendance-day-row" key={detail.day} style={{ display:"grid", gridTemplateColumns:"74px 105px minmax(160px,1fr) auto", gap:10, alignItems:"center", padding:"9px 10px", borderTop:index ? `1px solid ${C.lineSoft}` : "none", background:"#fff" }}>
                      <div style={{ fontSize:10.8, fontWeight:750, color:"#44595A" }}>{fmtShortDate(detail.day)}</div>
                      <Pill tone={detail.tone}>{detail.state}</Pill>
                      <div style={{ fontSize:10.8, color:C.soft }}>
                        {detail.sessions.length ? `${fmtTime(detail.firstStart)} → ${detail.hasOpen ? "Now" : fmtTime(detail.lastEnd)} · ${fmtDuration(detail.durationMs)}` : (detail.policy.exception?.label || (detail.policy.exception ? EXCEPTION_LABELS[detail.policy.exception.kind] : "No Start Day"))}
                      </div>
                      <div className="attendance-closing-detail" style={{ fontSize:10.3, color:C.soft, whiteSpace:"nowrap" }}>{detail.sessions.length ? (!detail.closingRequired ? "Closing not required" : detail.closingDone ? "Closing done" : "Closing pending") : "—"}</div>
                    </div>
                  ))}
                </div>
              </div>}
            </div>
          );
        }) : (
          <div style={{ padding:30, textAlign:"center", color:C.soft, fontSize:12.5 }}>No attendance records match these filters.</div>
        )}
      </section>

      {calendar && <div style={{ fontSize:10.3, color:"#8B9395", lineHeight:1.45, padding:"0 2px" }}>
        Schedule source: company working week ({daysLabel(calendar.company.workingDays)}), employee overrides, and approved calendar exceptions. Worked days always come from actual Start Day records.
      </div>}
    </div>
  );
}
