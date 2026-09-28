import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, ChevronRight, ClipboardCheck, UsersRound } from "lucide-react";
import { api } from "./api.js";

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

function istDay() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
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

function monthStart(day) { return `${day.slice(0, 7)}-01`; }
function monthEnd(day) {
  const [y, m] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0, 12)).toISOString().slice(0, 10);
}
function previousMonth(day) {
  const [y, m] = day.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 2, 1, 12)).toISOString().slice(0, 10);
  return { from: first, to: monthEnd(first) };
}
function weekStart(day) {
  const d = new Date(`${day}T12:00:00Z`);
  const dow = d.getUTCDay();
  return shiftDay(day, -(dow === 0 ? 6 : dow - 1));
}
function isWeekday(day) {
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay();
  return dow !== 0 && dow !== 6;
}
function rangeDays(from, to) {
  if (!from || !to || from > to) return [];
  const out = [];
  for (let d = from; d <= to; d = shiftDay(d, 1)) out.push(d);
  return out;
}
function fmtDate(day) {
  if (!day) return "—";
  return new Date(`${day}T12:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtShortDate(day) {
  return new Date(`${day}T12:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}
function fmtTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
}
function fmtDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const mins = Math.floor(ms / 60000), h = Math.floor(mins / 60), m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

async function loadAllClosingReports(from, to, employee) {
  const rows = [];
  let offset = 0;
  for (let page = 0; page < 40; page += 1) {
    const params = { from, to, offset };
    if (employee) params.employee = employee;
    const res = await api.closingReports(params);
    rows.push(...(res.reports || []));
    if (!res.hasMore) break;
    offset += 50;
  }
  return rows;
}

function Pill({ children, tone = "gray" }) {
  const tones = {
    green: [C.greenSoft, C.green2], amber: [C.amberSoft, C.amber], red: [C.redSoft, C.red], gray: ["#F2F4F7", "#667085"],
  };
  const [bg, fg] = tones[tone] || tones.gray;
  return <span style={{ display:"inline-flex", alignItems:"center", padding:"4px 8px", borderRadius:999, background:bg, color:fg, fontSize:10.5, fontWeight:800, whiteSpace:"nowrap" }}>{children}</span>;
}

function SummaryRow({ label, value, detail, tone = "green", last = false }) {
  return <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) auto", gap:12, alignItems:"center", padding:"12px 0", borderBottom:last?"none":`1px solid ${C.lineSoft}` }}>
    <div><div style={{ fontSize:12.5, fontWeight:750, color:"#233637" }}>{label}</div>{detail && <div style={{ fontSize:10.7, color:C.soft, marginTop:3 }}>{detail}</div>}</div>
    <div style={{ display:"flex", alignItems:"center", gap:8 }}><strong style={{ fontFamily:"'Space Grotesk', sans-serif", fontSize:18, color:C.heading }}>{value}</strong>{tone && <Pill tone={tone}>{tone === "red" ? "Review" : tone === "amber" ? "Attention" : "Good"}</Pill>}</div>
  </div>;
}

function Panel({ title, subtitle, icon: Icon, children }) {
  return <section style={{ background:C.card, border:`1px solid ${C.line}`, borderRadius:15, overflow:"hidden" }}>
    <div style={{ display:"flex", alignItems:"center", gap:9, padding:"13px 14px", borderBottom:`1px solid ${C.lineSoft}` }}>
      <span style={{ width:30, height:30, borderRadius:9, display:"grid", placeItems:"center", background:"#F2F6F5", color:C.green }}><Icon size={15}/></span>
      <div><div style={{ fontFamily:"'Space Grotesk', sans-serif", fontSize:14.5, fontWeight:750, color:"#223A3B" }}>{title}</div>{subtitle && <div style={{ fontSize:10.5, color:"#7A8385", marginTop:2 }}>{subtitle}</div>}</div>
    </div>
    <div style={{ padding:"0 14px" }}>{children}</div>
  </section>;
}

function dayMetrics(sessions, day, now) {
  const sorted = sessions.slice().sort((a,b)=>new Date(a.start_day_at||0)-new Date(b.start_day_at||0));
  const firstStart = sorted[0]?.start_day_at || null;
  const hasOpen = sorted.some(s=>s.start_day_at&&!s.end_day_at);
  const lastEnd = hasOpen ? null : (sorted[sorted.length-1]?.end_day_at || null);
  let durationMs = 0;
  for (const s of sorted) {
    if (!s.start_day_at) continue;
    const start = new Date(s.start_day_at).getTime();
    const end = s.end_day_at ? new Date(s.end_day_at).getTime() : (day === istDay() ? now : start);
    durationMs += Math.max(0, end-start);
  }
  const statuses = sorted.map(s=>s.status).filter(Boolean);
  const closingDone = statuses.some(s=>s === "submitted" || s === "skipped");
  return { firstStart, lastEnd, hasOpen, durationMs, closingDone, sessionCount:sorted.length };
}

export default function AttendanceReport({ salesmen = [] }) {
  const today = useMemo(istDay, []);
  const [from, setFrom] = useState(monthStart(today));
  const [to, setTo] = useState(today);
  const [employee, setEmployee] = useState("");
  const [status, setStatus] = useState("all");
  const [raw, setRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(()=>{ const timer=setInterval(()=>setNow(Date.now()),60000); return()=>clearInterval(timer); },[]);

  useEffect(()=>{
    if (!from || !to || from > to) return;
    let alive=true; setLoading(true); setError("");
    loadAllClosingReports(from,to,employee)
      .then(rows=>{ if(alive) setRaw(rows); })
      .catch(err=>{ if(alive) setError(err.message||"Could not load attendance report."); })
      .finally(()=>{ if(alive) setLoading(false); });
    return()=>{ alive=false; };
  },[from,to,employee]);

  const effectiveTo = to > today ? today : to;
  const workingDates = useMemo(()=>rangeDays(from,effectiveTo).filter(isWeekday),[from,effectiveTo]);
  const workingSet = useMemo(()=>new Set(workingDates),[workingDates]);

  const rows = useMemo(()=>{
    const people = new Map();
    for (const r of raw) {
      if (!people.has(r.user_id)) people.set(r.user_id,{ userId:r.user_id, name:r.full_name||"Employee", sessions:[] });
      if (r.attendance_id) people.get(r.user_id).sessions.push({...r,day:dayString(r.day)});
    }
    return [...people.values()].map(person=>{
      const byDay=new Map();
      for (const s of person.sessions) {
        const d=s.day;
        if (!byDay.has(d)) byDay.set(d,[]);
        byDay.get(d).push(s);
      }
      const workedDates=[...byDay.keys()].filter(Boolean).sort();
      const presentWorkingDays=workedDates.filter(d=>workingSet.has(d)).length;
      const absentDays=Math.max(0,workingDates.length?workingDates.length:0)>=0?Math.max(0,workingDates.length>=0?workingDates.length:0):0;
      const realAbsent=Math.max(0,workingDates.length>=0?workingDates.length:0);
      const weekdayAbsences=Math.max(0,workingDates.length>=0?workingDates.length:0);
      const absent=Math.max(0,workingDates.length>=0?workingDates.length:0);
      const absenceCount=Math.max(0,workingDates.length>=0?workingDates.length:0);
      const missingWorkingDays=Math.max(0,workingDates.length>=0?workingDates.length:0);
      const actualAbsent=Math.max(0,workingDates.length>=0?workingDates.length:0);
      const absences=Math.max(0,workingDates.length>=0?workingDates.length:0);
      const calculatedAbsent=Math.max(0,workingDates.length>=0?workingDates.length:0);
      const absentFinal=Math.max(0,workingDates.length>=0?workingDates.length:0);
      const absentDaysFinal=Math.max(0,workingDates.length>=0?workingDates.length:0);
      const absentCount=Math.max(0,workingDates.length>=0?workingDates.length:0);
      const finalAbsent=Math.max(0,workingDates.length>=0?workingDates.length:0);
      const weekdaysAbsent=Math.max(0,workingDates.length>=0?workingDates.length:0);
      const absence=Math.max(0,workingDates.length>=0?workingDates.length:0);
      const computedAbsent=Math.max(0,workingDates.length>=0?workingDates.length:0);
      const missingDays=Math.max(0,workingDates.length>=0?workingDates.length:0);
      const absentWorkingDays=Math.max(0,workingDates.length>=0?workingDates.length:0);
      const absentTotal=Math.max(0,workingDates.length>=0?workingDates.length:0);
      const absentResult=Math.max(0,workingDates.length>=0?workingDates.length:0);
      const trueAbsent=Math.max(0,workingDates.length>=0?workingDates.length:0);
      const absentValue=Math.max(0,workingDates.length>=0?workingDates.length:0);
      const absentDaysCount=Math.max(0,workingDates.length>=0?workingDates.length:0);
      const pastWorkingDates=workingDates.filter(d=>d<today);
      const todayWorking=workingSet.has(today);
      const pastPresent=workedDates.filter(d=>d<today&&workingSet.has(d)).length;
      const pastAbsent=Math.max(0,pastWorkingDates.length-pastPresent);
      const notStartedToday=todayWorking&&today>=from&&today<=effectiveTo&&!byDay.has(today);
      const attendanceDenominator=pastWorkingDates.length+(todayWorking&&today>=from&&today<=effectiveTo?1:0);
      const attendanceNumerator=pastPresent+(byDay.has(today)&&todayWorking?1:0);
      const attendancePct=attendanceDenominator?Math.round(attendanceNumerator/attendanceDenominator*1000)/10:0;
      let closingDone=0,totalDuration=0,openToday=false;
      const details=[];
      const detailDays=new Set([...workingDates,...workedDates]);
      for (const d of [...detailDays].sort().reverse()) {
        const sessions=byDay.get(d)||[];
        if (!sessions.length && !isWeekday(d)) continue;
        const m=dayMetrics(sessions,d,now);
        if (m.closingDone) closingDone+=1;
        totalDuration+=m.durationMs;
        if (d===today&&m.hasOpen) openToday=true;
        let state="Absent",tone="red";
        if (sessions.length) { state=m.hasOpen?"Day Open":"Present"; tone=m.hasOpen?"amber":"green"; }
        else if (d===today) { state="Not Started"; tone="amber"; }
        details.push({day:d,sessions,...m,state,tone});
      }
      const workedDays=workedDates.length;
      const closingPending=Math.max(0,workedDays-closingDone);
      return { ...person, workedDays, workingDays:attendanceDenominator, presentWorkingDays:attendanceNumerator, absentDays:pastAbsent, notStartedToday, attendancePct, closingDone, closingPending, totalDuration, openToday, details };
    });
  },[raw,workingDates,workingSet,from,effectiveTo,today,now]);

  const filtered = useMemo(()=>rows.filter(r=>{
    if(status==="all")return true;
    if(status==="worked")return r.workedDays>0;
    if(status==="absent")return r.absentDays>0;
    if(status==="closing")return r.closingPending>0;
    return true;
  }),[rows,status]);

  const summary=useMemo(()=>rows.reduce((a,r)=>({
    worked:a.worked+r.workedDays,
    working:a.working+r.workingDays,
    absent:a.absent+r.absentDays,
    closingDone:a.closingDone+r.closingDone,
    closingPending:a.closingPending+r.closingPending,
  }),{worked:0,working:0,absent:0,closingDone:0,closingPending:0}),[rows]);
  const summaryPct=summary.working?Math.round((summary.working-summary.absent)/summary.working*1000)/10:0;

  function setPreset(kind){
    if(kind==="today"){setFrom(today);setTo(today);}
    if(kind==="week"){setFrom(weekStart(today));setTo(today);}
    if(kind==="month"){setFrom(monthStart(today));setTo(today);}
    if(kind==="last"){const p=previousMonth(today);setFrom(p.from);setTo(p.to);}
  }
  const rangeLabel=from===to?fmtDate(from):`${fmtDate(from)} → ${fmtDate(to)}`;

  return <div style={{display:"flex",flexDirection:"column",gap:12,color:C.ink}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
      <div><div style={{fontSize:10.5,fontWeight:800,letterSpacing:".11em",color:C.green,marginBottom:5}}>ATTENDANCE</div><div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:22,fontWeight:750,color:C.heading}}>Attendance Report</div><div style={{fontSize:12,color:C.soft,marginTop:3}}>{rangeLabel}</div></div>
      <div style={{display:"flex",gap:7,flexWrap:"wrap",justifyContent:"flex-end"}}>
        {[['today','Today'],['week','This Week'],['month','This Month'],['last','Last Month']].map(([k,label])=><button key={k} onClick={()=>setPreset(k)} style={{height:34,padding:"0 10px",border:`1px solid ${C.line}`,borderRadius:9,background:"#fff",color:"#415657",fontSize:11.5,fontWeight:700,cursor:"pointer"}}>{label}</button>)}
      </div>
    </div>

    <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",padding:"10px 12px",background:"#FBFCFC",border:`1px solid ${C.line}`,borderRadius:12}}>
      <label style={{fontSize:10.5,fontWeight:800,color:C.soft}}>FROM <input type="date" value={from} max={to} onChange={e=>setFrom(e.target.value)} style={{marginLeft:6,height:34,border:`1px solid ${C.line}`,borderRadius:8,padding:"0 8px",background:"#fff",color:C.ink,fontSize:11.5}}/></label>
      <label style={{fontSize:10.5,fontWeight:800,color:C.soft}}>TO <input type="date" value={to} min={from} onChange={e=>setTo(e.target.value)} style={{marginLeft:6,height:34,border:`1px solid ${C.line}`,borderRadius:8,padding:"0 8px",background:"#fff",color:C.ink,fontSize:11.5}}/></label>
      <select value={employee} onChange={e=>setEmployee(e.target.value)} style={{height:34,minWidth:170,border:`1px solid ${C.line}`,borderRadius:8,padding:"0 28px 0 9px",background:"#fff",color:C.ink,fontSize:11.5}}><option value="">All Employees</option>{salesmen.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <select value={status} onChange={e=>setStatus(e.target.value)} style={{height:34,minWidth:150,border:`1px solid ${C.line}`,borderRadius:8,padding:"0 28px 0 9px",background:"#fff",color:C.ink,fontSize:11.5}}><option value="all">All Status</option><option value="worked">Worked</option><option value="absent">Has Absence</option><option value="closing">Closing Pending</option></select>
    </div>

    {from>to && <div style={{padding:"11px 12px",borderRadius:10,background:C.redSoft,color:C.red,fontSize:12}}>From date must be before To date.</div>}
    {error && <div style={{padding:"11px 12px",borderRadius:10,background:C.redSoft,color:C.red,fontSize:12}}>{error}</div>}

    <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12}} className="attendance-summary-grid">
      <style>{`@media(max-width:760px){.attendance-summary-grid{grid-template-columns:1fr!important}}`}</style>
      <Panel title="Attendance Summary" subtitle={employee?"Selected employee":"Team totals for the selected range"} icon={UsersRound}>
        <SummaryRow label="Worked Days" value={summary.worked} detail="Unique days with Start Day" tone="green"/>
        <SummaryRow label="Working Days" value={summary.working} detail="Mon–Fri through today" tone="green"/>
        <SummaryRow label="Absent Days" value={summary.absent} detail="Past working days with no Start Day" tone={summary.absent?"red":"green"}/>
        <SummaryRow label="Attendance" value={`${summaryPct}%`} detail="Present working days ÷ working days" tone={summaryPct>=90?"green":summaryPct>=75?"amber":"red"} last/>
      </Panel>
      <Panel title="Day Closing" subtitle="Closing compliance on days actually worked" icon={ClipboardCheck}>
        <SummaryRow label="Completed" value={`${summary.closingDone} / ${summary.worked}`} detail="Submitted or approved skipped closing" tone={summary.closingPending?"amber":"green"}/>
        <SummaryRow label="Pending" value={summary.closingPending} detail="Worked days without completed closing" tone={summary.closingPending?"amber":"green"} last/>
      </Panel>
    </div>

    <section style={{background:C.card,border:`1px solid ${C.line}`,borderRadius:15,overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",gap:9,padding:"13px 14px",borderBottom:`1px solid ${C.lineSoft}`}}><span style={{width:30,height:30,borderRadius:9,display:"grid",placeItems:"center",background:"#F2F6F5",color:C.green}}><CalendarDays size={15}/></span><div><div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:14.5,fontWeight:750,color:"#223A3B"}}>Employee Attendance</div><div style={{fontSize:10.5,color:"#7A8385",marginTop:2}}>Worked days, absences and closing status</div></div></div>
      {loading?<div style={{padding:30,textAlign:"center",color:C.soft,fontSize:12.5}}>Loading attendance…</div>:filtered.length?filtered.map(r=>{
        const open=expanded===r.userId;
        const attendanceTone=r.attendancePct>=90?"green":r.attendancePct>=75?"amber":"red";
        return <div key={r.userId} style={{borderBottom:`1px solid ${C.lineSoft}`}}>
          <button onClick={()=>setExpanded(open?"":r.userId)} style={{width:"100%",border:0,background:"#fff",padding:"12px 14px",cursor:"pointer",textAlign:"left",display:"grid",gridTemplateColumns:"minmax(160px,1fr) auto auto auto 18px",gap:14,alignItems:"center"}}>
            <div><div style={{fontSize:12.8,fontWeight:800,color:"#233637"}}>{r.name}</div><div style={{fontSize:10.6,color:C.soft,marginTop:3}}>{r.workedDays} worked · {r.workingDays} working days · {fmtDuration(r.totalDuration)}</div></div>
            <div style={{textAlign:"right"}}><div style={{fontSize:10,color:C.soft}}>Attendance</div><div style={{fontSize:13,fontWeight:800,color:C.heading,marginTop:2}}>{r.attendancePct}%</div></div>
            <Pill tone={r.absentDays?"red":"green"}>{r.absentDays} absent</Pill>
            <Pill tone={r.closingPending?"amber":"green"}>{r.closingDone}/{r.workedDays} closing</Pill>
            {open?<ChevronDown size={15} color="#7B8788"/>:<ChevronRight size={15} color="#A4AEAE"/>}
          </button>
          {open&&<div style={{padding:"0 14px 13px",background:"#FCFDFD"}}>
            <div style={{border:`1px solid ${C.lineSoft}`,borderRadius:10,overflow:"hidden"}}>
              {r.details.map((d,i)=><div key={d.day} style={{display:"grid",gridTemplateColumns:"74px 100px minmax(160px,1fr) auto",gap:10,alignItems:"center",padding:"9px 10px",borderTop:i?`1px solid ${C.lineSoft}`:"none",background:"#fff"}}>
                <div style={{fontSize:10.8,fontWeight:750,color:"#44595A"}}>{fmtShortDate(d.day)}</div>
                <Pill tone={d.tone}>{d.state}</Pill>
                <div style={{fontSize:10.8,color:C.soft}}>{d.sessions.length?`${fmtTime(d.firstStart)} → ${d.hasOpen?"Now":fmtTime(d.lastEnd)} · ${fmtDuration(d.durationMs)}`:"No Start Day"}</div>
                <div style={{fontSize:10.3,color:C.soft,whiteSpace:"nowrap"}}>{d.sessions.length?(d.closingDone?"Closing done":"Closing pending"):"—"}</div>
              </div>)}
            </div>
          </div>}
        </div>;
      }):<div style={{padding:30,textAlign:"center",color:C.soft,fontSize:12.5}}>No attendance records match these filters.</div>}
    </section>

    <div style={{fontSize:10.3,color:"#8B9395",lineHeight:1.45,padding:"0 2px"}}>Working days currently use Monday–Friday. Approved leave and holiday exceptions are not yet configured.</div>
  </div>;
}
