import React,{useEffect,useState} from "react";
import {api} from "./api.js";
import {OnboardingDialog} from "./Onboarding.jsx";
import "./quotations.css";
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const tm=v=>v?new Date(v).toLocaleTimeString("en-IN",{hour:"numeric",minute:"2-digit",timeZone:"Asia/Kolkata"}):"";
const money=n=>`₹${Number(n||0).toLocaleString("en-IN")}`;
const Box=({title,children})=><section className="ft-q-box" style={{marginTop:12}}><h3 style={{marginBottom:10}}>{title}</h3>{children}</section>;
const Metric=({n,label})=><div style={{minWidth:105}}><strong style={{display:"block",fontSize:22}}>{n}</strong><span className="ft-ob-muted" style={{fontSize:11.5}}>{label}</span></div>;
export default function SalesmanBriefPopup({salesman,onClose}){
 const [date,setDate]=useState(today()),[data,setData]=useState(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{let live=true;setLoading(true);setError("");api.adminSalesmanBrief(salesman.id,date).then(v=>live&&setData(v)).catch(e=>live&&(setData(null),setError(e.message||"Couldn't load the brief."))).finally(()=>live&&setLoading(false));return()=>{live=false}},[salesman.id,date]);
 const g=data?.glance||{},h=data?.followUpHealth||{},u=data?.unfinished||{};
 return <OnboardingDialog title={`Daily Brief — ${salesman.name||"Employee"}`} onClose={onClose} busy={false}><div className="ft-q">
  <label className="ft-ob-field">Date · IST<input type="date" value={date} max={today()} onChange={e=>setDate(e.target.value)}/></label>
  {error&&<p role="alert">{error}</p>}{loading&&<p>Loading…</p>}
  {!loading&&data&&<>
   <Box title="Today at a glance"><div style={{display:"flex",gap:20,flexWrap:"wrap"}}><Metric n={g.leadsAdded||0} label="Leads added"/><Metric n={g.visits||0} label="Recorded visits"/><Metric n={g.stageChanges||0} label="Stage changes"/><Metric n={g.quotesCreated||0} label="Quotes created"/><Metric n={g.won||0} label="Won"/><Metric n={g.tasksCompleted||0} label="Tasks completed"/>{g.paymentTotal>0&&<Metric n={money(g.paymentTotal)} label="Collected"/>}</div></Box>
   <Box title="What progressed">{!data.progress?.stageChanges?.length?<p className="ft-ob-muted">No recorded pipeline movement on this day.</p>:data.progress.stageChanges.slice(0,8).map((x,i)=><div key={i} style={{padding:"7px 0",borderBottom:"1px solid #eef0f2",fontSize:13}}><strong>{x.business||"Lead"}</strong><div className="ft-ob-muted">{x.from||"—"} → {x.to||"—"} · {tm(x.at)}</div></div>)}</Box>
   <Box title={`Key outcomes${data.keyOutcomes?.length?` · ${data.keyOutcomes.length}`:""}`}>{!data.keyOutcomes?.length?<p className="ft-ob-muted">No major recorded outcome today.</p>:data.keyOutcomes.map((x,i)=><div key={i} style={{padding:"7px 0"}}><strong>{x.title}</strong><div className="ft-ob-muted">{x.detail} · {tm(x.at)}</div></div>)}</Box>
   <Box title={`Needs admin attention · ${data.attention?.length||0}`}>{!data.attention?.length?<p style={{color:"#12805c"}}>Nothing urgent from recorded CRM data.</p>:data.attention.map((x,i)=><div key={i} style={{padding:"8px 0",borderBottom:"1px solid #eef0f2"}}><strong>{x.level==='high'?"🔴":"🟠"} {x.title}</strong><div className="ft-ob-muted">{x.detail}</div></div>)}</Box>
   <Box title="Follow-up health"><div style={{display:"flex",gap:20,flexWrap:"wrap"}}><Metric n={h.dueToday||0} label="Due today"/><Metric n={h.overdue||0} label="Overdue"/><Metric n={h.scheduledAhead||0} label="Scheduled ahead"/><Metric n={h.noNextAction||0} label="No next action"/></div></Box>
   <Box title="Unfinished work"><div style={{display:"flex",gap:20,flexWrap:"wrap"}}><Metric n={u.pendingTasks||0} label="Pending tasks"/><Metric n={u.overdueTasks||0} label="Overdue tasks"/><Metric n={u.quotationsAwaiting||0} label="Quotes awaiting action"/><Metric n={u.leadsWithoutNextAction||0} label="Leads without next action"/></div></Box>
   <Box title="Recorded activity timeline">{!data.events?.length?<p className="ft-ob-muted">Nothing recorded.</p>:data.events.map((e,i)=><div key={i} style={{display:"flex",gap:10,padding:"5px 0",fontSize:13}}><span style={{minWidth:68,color:"#6b7785"}}>{tm(e.at)}</span><span>{e.text}</span></div>)}</Box>
   <Box title="Day closing">{!data.closing?.length?<p className="ft-ob-muted">No submitted closing report for this day.</p>:data.closing.map((c,i)=><div key={i}><p><strong>{c.status==='submitted'?"✓ Submitted":c.status==='skipped'?"Skipped":"Not required"}</strong>{c.submittedAt?` · ${tm(c.submittedAt)}`:""}</p>{c.outcomes&&<><strong>Outcome</strong><p className="ft-q-text">{c.outcomes}</p></>}{c.blockers&&<><strong>Blockers</strong><p className="ft-q-text">{c.blockers}</p></>}{c.priorities&&<><strong>Tomorrow's priorities</strong><p className="ft-q-text" style={{whiteSpace:"pre-wrap"}}>{c.priorities}</p></>}{c.skipReason&&<><strong>Skip reason</strong><p className="ft-q-text">{c.skipReason}</p></>}</div>)}</Box>
  </>}
 </div></OnboardingDialog>;
}
