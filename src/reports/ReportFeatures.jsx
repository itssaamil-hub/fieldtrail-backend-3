import React from "react";

// Extracted from App.jsx without changing report behavior.
// Dependencies stay explicit so report UI remains testable and App.jsx stays orchestration-only.
export function createReportFeatures(deps) {
  const { React, useState, useEffect, useRef, useCallback, api, ApiError, T, fmtMoney, fmtTime, isToday, isThisMonth, isWithinDays, isUpcomingRenewalMonth, STATUS_LABEL, STATUSES, inputStyle, Select, Overlay, Field, DownloadMenu, buildExportUrl, LeadBriefPopup, buildLeadBrief, leadAvatarStyle, leadInitials, L, EXPENSE_CATEGORIES, Loader2, CalendarClock, TargetIcon, Contact2, PhoneIcon, MapPin, Receipt, Wallet, CheckCircle2, RefreshCw, Route, Pencil, Trash2, Search, X } = deps;

function DataQualityReport({ salesmen }) {
  const [employee, setEmployee] = useState("");
  const [issue, setIssue] = useState("all");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true); setError("");
    api.dataQualityReport({ ...(employee ? { salesmanId: employee } : {}), ...(issue !== "all" ? { issue } : {}) })
      .then(setData).catch((e) => setError(e.message || "Couldn't load data quality.")).finally(() => setLoading(false));
  }, [employee, issue]);
  useEffect(() => { load(); }, [load]);

  const labels = { followup:"No follow-up", contact:"No contact", location:"No location", pos:"Missing POS", deal_value:"Deal value" };
  const issueCards = [
    ["followup","No follow-up",CalendarClock],
    ["contact","No contact",PhoneIcon],
    ["location","No location",MapPin],
    ["pos","Missing POS",Receipt],
    ["deal_value","Deal value",Wallet],
  ];
  const totalIssues = data ? Object.keys(labels).reduce((n,k)=>n+Number(data.counts?.[k]||0),0) : 0;
  const affected = Number(data?.counts?.total || 0);

  return <div>
    <div style={{marginBottom:16}}>
      <div style={{fontFamily:"'Space Grotesk', sans-serif",fontWeight:750,fontSize:19,color:T.ink}}>Data quality</div>
      <div style={{fontSize:12.5,color:T.inkSoft,marginTop:3}}>Keep your CRM complete and sales-ready.</div>
    </div>

    {loading && <div style={{fontSize:13,color:T.inkSoft,display:"flex",gap:7,alignItems:"center"}}><Loader2 size={14} className="spin"/> Checking CRM data…</div>}
    {error && <div style={{fontSize:13,color:T.danger}}>{error}</div>}
    {data && !loading && <>
      <div style={{background:"linear-gradient(135deg, #123F3D 0%, #17635C 100%)",borderRadius:16,padding:"18px 18px 16px",color:"#fff",marginBottom:14,boxShadow:"0 8px 24px rgba(18,63,61,.12)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:12,flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:.7,opacity:.72,fontWeight:700}}>CRM DATA CHECK</div>
            <div style={{fontSize:28,fontWeight:800,marginTop:5,lineHeight:1}}>{affected}</div>
            <div style={{fontSize:13,opacity:.9,marginTop:5}}>{affected === 1 ? "lead needs fixing" : "leads need fixing"}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:22,fontWeight:800}}>{totalIssues}</div>
            <div style={{fontSize:11.5,opacity:.75}}>missing items</div>
          </div>
        </div>
      </div>

      <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:.55,color:T.inkSoft,fontWeight:800,margin:"16px 0 9px"}}>Issues</div>
      <div className="dq-issue-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(125px,1fr))",gap:8,marginBottom:15}}>
        {issueCards.map(([key,label,Icon])=>{
          const selected=issue===key;
          return <button key={key} onClick={()=>setIssue(selected?"all":key)} style={{textAlign:"left",background:selected?"#EAF5F0":"#fff",border:`1px solid ${selected?T.route:T.line}`,borderRadius:12,padding:"11px 12px",cursor:"pointer",color:T.ink,minHeight:76}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
              <span style={{width:27,height:27,borderRadius:8,background:selected?T.route:"#F3F7F5",color:selected?"#fff":T.route,display:"inline-flex",alignItems:"center",justifyContent:"center"}}><Icon size={14}/></span>
              <span style={{fontSize:18,fontWeight:800}}>{data.counts?.[key]||0}</span>
            </div>
            <div style={{fontSize:11.5,fontWeight:700,marginTop:7,color:selected?T.route:T.inkSoft}}>{label}</div>
          </button>
        })}
      </div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:11}}>
        <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:.55,color:T.inkSoft,fontWeight:800}}>Leads to fix · {affected}</div>
        <div style={{display:"flex",gap:7}}>
          <select value={employee} onChange={e=>setEmployee(e.target.value)} style={{height:34,border:`1px solid ${T.line}`,borderRadius:9,padding:"0 9px",background:"#fff",color:T.ink,fontSize:12}}>
            <option value="">All employees</option>
            {salesmen.map(x=><option key={x.id} value={x.id}>{x.name || x.fullName || x.full_name}</option>)}
          </select>
          {issue!=="all" && <button onClick={()=>setIssue("all")} style={{height:34,border:`1px solid ${T.line}`,borderRadius:9,padding:"0 10px",background:"#fff",color:T.inkSoft,fontSize:12,cursor:"pointer"}}>Clear</button>}
        </div>
      </div>

      <div style={{display:"grid",gap:8}}>
        {(data.leads||[]).map(lead=><div key={lead.id} style={{background:"#fff",border:`1px solid ${T.line}`,borderRadius:13,padding:"12px 13px",boxShadow:"0 1px 2px rgba(20,20,30,.025)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
            <div style={{display:"flex",gap:10,minWidth:0}}>
              <div style={{...leadAvatarStyle(lead.business_name),width:34,height:34,minWidth:34,fontSize:11}}>{leadInitials(lead.business_name)}</div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:13.5,fontWeight:750,color:T.ink,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{lead.business_name}</div>
                <div style={{fontSize:11.5,color:T.inkSoft,marginTop:2}}>{STATUS_LABEL[lead.status]||lead.status} · {lead.salesman_name}</div>
              </div>
            </div>
            <span style={{fontSize:17,color:T.inkSoft}}>›</span>
          </div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:9,paddingLeft:44}}>
            {lead.issues.map(k=><span key={k} style={{fontSize:10.5,padding:"4px 7px",borderRadius:999,background:"#FFF7E8",border:"1px solid #F3DFC0",color:"#8B5E00",fontWeight:650}}>⚠ {labels[k]}</span>)}
          </div>
        </div>)}
        {!data.leads?.length && <div style={{padding:"28px 18px",textAlign:"center",background:"#fff",border:`1px solid ${T.line}`,borderRadius:13}}>
          <CheckCircle2 size={24} color={T.route}/>
          <div style={{fontSize:13.5,fontWeight:700,color:T.ink,marginTop:8}}>Everything looks clean</div>
          <div style={{fontSize:12,color:T.inkSoft,marginTop:3}}>No data-quality issues for this filter.</div>
        </div>}
      </div>
    </>}
  </div>;
}

function SalesmanPerformanceReport({ salesmen }) {
  const now = new Date();
  const localDay = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
  const [anchor,setAnchor]=useState(localDay);
  const [employee,setEmployee]=useState("");
  const [data,setData]=useState(null);
  const [targets,setTargets]=useState([]);
  const [insights,setInsights]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [expandedEmployee,setExpandedEmployee]=useState(null);

  const money=n=>fmtMoney(Number(n||0));
  const conversion=(a,b)=>Number(a)>0?Math.round(Number(b||0)/Number(a)*100):0;
  const pct=(value,target)=>Number(target)>0?Math.min(100,Math.round(Number(value||0)/Number(target)*100)):null;
  const monthLabel=new Date(`${anchor.slice(0,7)}-01T00:00:00`).toLocaleDateString("en-IN",{month:"long",year:"numeric"});
  const targetFor=id=>targets.find(t=>t.salesman_id===id)||{};
  const insightFor=id=>(insights?.employees||[]).find(x=>String(x.id||x.salesman_id)===String(id))||null;

  const progressState=(r,tg)=>{
    if(Number(r.leads||0)===0&&Number(r.visits||0)===0)return {label:"No activity",tone:"quiet"};
    const vals=[pct(r.leads,tg.leads_target),pct(r.demos,tg.demos_target),pct(r.won,tg.won_target),pct(r.sales_value,tg.sales_value_target)];
    if(vals.some(v=>v!=null&&v>=100))return {label:"On target",tone:"strong"};
    if(vals.filter(v=>v!=null).length&&vals.filter(v=>v!=null).every(v=>v<60))return {label:"Behind",tone:"behind"};
    if(vals.every(v=>v==null))return {label:"No target",tone:"quiet"};
    return {label:"Active",tone:"active"};
  };

  const metric=(label,value,target,format=false)=>{const progress=pct(value,target);return <div style={{padding:"9px 0",borderBottom:`1px solid ${T.line}`}}><div style={{display:"flex",justifyContent:"space-between",gap:10,fontSize:12}}><span style={{color:T.inkSoft}}>{label}</span><strong style={{color:T.ink}}>{format?money(value):value}{Number(target)>0?` / ${format?money(target):target}`:""}</strong></div>{progress!=null&&<div style={{display:"flex",alignItems:"center",gap:8,marginTop:6}}><div style={{height:6,background:"#E9EFEC",borderRadius:99,overflow:"hidden",flex:1}}><div style={{height:"100%",width:`${progress}%`,background:T.route,borderRadius:99}}/></div><span style={{fontSize:10,color:T.inkSoft,minWidth:30,textAlign:"right"}}>{progress}%</span></div>}</div>};

  const load=useCallback(()=>{
    setLoading(true);setError("");
    Promise.all([
      api.performanceReport({period:"month",anchor,...(employee?{salesmanId:employee}:{})}),
      api.performanceTargets({month:anchor}),
      api.performanceInsights({month:anchor.slice(0,7),...(employee?{salesmanId:employee}:{})}).catch(()=>null)
    ]).then(([p,t,i])=>{setData(p);setTargets(t.targets||[]);setInsights(i);setExpandedEmployee(prev=>prev&&p.rows?.some(x=>x.id===prev)?prev:(p.rows?.[0]?.id||null));}).catch(e=>setError(e.message||"Couldn't load performance.")).finally(()=>setLoading(false));
  },[anchor,employee]);
  useEffect(()=>{load()},[load]);

  return <div className="engage-performance-report-page">
    <div className="engage-performance-hero" style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:14,flexWrap:"wrap",marginBottom:18}}>
      <div><div className="engage-performance-kicker">SALES PERFORMANCE</div><div style={{fontSize:22,fontWeight:850,color:T.ink}}>Monthly Performance</div><div style={{fontSize:12.5,color:T.inkSoft,marginTop:4}}>{monthLabel} · Restaurant visits → Leads → Demos → Won → Sales value.</div></div>
      <div className="engage-performance-filters" style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <input type="month" value={anchor.slice(0,7)} onChange={e=>setAnchor(`${e.target.value}-01`)} style={{height:40,border:`1px solid ${T.line}`,borderRadius:10,padding:"0 11px",background:"#fff",color:T.ink}}/>
        <select value={employee} onChange={e=>setEmployee(e.target.value)} style={{height:40,border:`1px solid ${T.line}`,borderRadius:10,padding:"0 11px",background:"#fff",color:T.ink,minWidth:155}}><option value="">All employees</option>{salesmen.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <button type="button" onClick={load} disabled={loading} style={{height:40,border:`1px solid ${T.line}`,borderRadius:10,padding:"0 13px",background:"#fff",color:T.route,fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}><RefreshCw size={14}/> Refresh</button>
      </div>
    </div>
    {error&&<div style={{padding:11,borderRadius:10,background:"#fff3f0",color:T.danger,marginBottom:12,fontSize:12.5}}>{error}</div>}
    {loading?<div style={{padding:24,color:T.inkSoft}}>Loading performance…</div>:data&&<>
      <div style={{background:"#fff",border:`1px solid ${T.line}`,borderRadius:16,padding:"14px 16px",marginBottom:14,overflowX:"auto"}}><div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr auto 1fr auto 1fr auto 1fr",alignItems:"center",gap:10,minWidth:760}}>{[["Restaurant visits",data.totals.visits],["Leads",data.totals.leads],["Demos",data.totals.demos],["Won",data.totals.won],["Sales",money(data.totals.sales_value)]].map(([label,value],idx)=><React.Fragment key={label}><div style={{background:"#F8FAF9",border:`1px solid ${T.line}`,borderRadius:12,padding:"11px 12px"}}><div style={{fontSize:9.5,color:T.inkSoft,fontWeight:800,textTransform:"uppercase",letterSpacing:.4}}>{label}</div><div style={{fontSize:20,fontWeight:850,color:T.ink,marginTop:3}}>{value}</div></div>{idx<4&&<div style={{fontSize:13,color:T.inkSoft,fontWeight:800}}>→</div>}</React.Fragment>)}</div></div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:10,marginBottom:20}}>{[["Leads",data.totals.leads,T.route],["Restaurant visits",data.totals.visits,"#52778A"],["Demos",data.totals.demos,"#7561A8"],["Won",data.totals.won,T.verified],["Sales value",money(data.totals.sales_value),T.warn]].map(([l,v,c])=><div key={l} style={{background:"#fff",border:`1px solid ${T.line}`,borderRadius:14,padding:"13px 14px",minWidth:0}}><div style={{fontSize:10,color:T.inkSoft,textTransform:"uppercase",letterSpacing:.45,fontWeight:800}}>{l}</div><div style={{fontSize:23,fontWeight:850,color:c,marginTop:5}}>{v}</div></div>)}</div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:9}}><div style={{fontSize:11,textTransform:"uppercase",letterSpacing:.6,color:T.inkSoft,fontWeight:850}}>Employee performance</div><div style={{fontSize:11.5,color:T.inkSoft}}>{data.rows.length} employee{data.rows.length===1?'':'s'}</div></div>
      <div style={{display:"grid",gap:10}}>{data.rows.map(r=>{const tg=targetFor(r.id);const ins=insightFor(r.id);const state=progressState(r,tg);const isOpen=expandedEmployee===r.id;const avgDeal=Number(r.won||0)>0?Number(r.sales_value||0)/Number(r.won):0;return <div key={r.id} className="engage-performance-employee-card" style={{background:"#fff",border:`1px solid ${T.line}`,borderRadius:16,padding:16,boxShadow:"0 1px 2px rgba(20,20,30,.025)"}}>
        <button type="button" onClick={()=>setExpandedEmployee(isOpen?null:r.id)} aria-expanded={isOpen} style={{width:"100%",border:"none",background:"transparent",padding:0,cursor:"pointer",textAlign:"left"}}>
          <div style={{display:"grid",gridTemplateColumns:"minmax(220px,1.3fr) repeat(5,minmax(70px,.55fr)) auto",gap:12,alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}><div style={{...leadAvatarStyle(r.full_name),width:36,height:36,minWidth:36,fontSize:12}}>{leadInitials(r.full_name)}</div><div><div style={{fontSize:15.5,fontWeight:850,color:T.ink}}>{r.full_name}</div><div style={{fontSize:11.5,color:T.inkSoft,marginTop:2}}>{r.won} won · {money(r.sales_value)} sales</div></div></div>
            {[["Visits",r.visits],["Leads",r.leads],["Demos",r.demos],["Won",r.won],["Sales",money(r.sales_value)]].map(([l,v])=><div key={l}><div style={{fontSize:9,color:T.inkSoft,textTransform:"uppercase",fontWeight:800}}>{l}</div><div style={{fontSize:13,fontWeight:800,color:T.ink,marginTop:2}}>{v}</div></div>)}
            <div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"flex-end"}}><span style={{fontSize:10.5,fontWeight:850,padding:"5px 9px",borderRadius:999,background:state.tone==='strong'?"#E6F6EF":state.tone==='behind'?"#FFF0EA":"#F1F3F4",color:state.tone==='strong'?T.verified:state.tone==='behind'?"#B45309":T.inkSoft,whiteSpace:"nowrap"}}>{state.label}</span><span style={{fontSize:16,color:T.inkSoft}}>{isOpen?"▴":"▾"}</span></div>
          </div>
        </button>

        {isOpen&&<div style={{display:"grid",gridTemplateColumns:"minmax(0,1.15fr) minmax(280px,.85fr)",gap:18,paddingTop:14,marginTop:13,borderTop:`1px solid ${T.line}`}}>
          <div><div style={{fontSize:10,textTransform:"uppercase",letterSpacing:.5,fontWeight:850,color:T.inkSoft,marginBottom:2}}>Performance overview</div>{metric("Restaurant visits",r.visits,tg.visits_target)}{metric("New leads",r.leads,tg.leads_target)}{metric("Demos",r.demos,tg.demos_target)}{metric("Deals won",r.won,tg.won_target)}{metric("Sales value",r.sales_value,tg.sales_value_target,true)}</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}><div><div style={{fontSize:10,textTransform:"uppercase",letterSpacing:.5,fontWeight:850,color:T.inkSoft,marginBottom:7}}>Conversion rates</div><div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:7}}>{[["Lead → Demo",`${conversion(r.leads,r.demos)}%`],["Demo → Won",`${conversion(r.demos,r.won)}%`],["Lead → Won",`${conversion(r.leads,r.won)}%`]].map(([l,v])=><div key={l} style={{background:"#F7FAF9",border:`1px solid ${T.line}`,borderRadius:10,padding:"10px 9px"}}><strong style={{fontSize:17,color:T.ink}}>{v}</strong><div style={{fontSize:9.5,color:T.inkSoft,marginTop:2}}>{l}</div></div>)}</div></div><div style={{background:"#F8FAFC",border:`1px solid ${T.line}`,borderRadius:11,padding:"11px 12px"}}><div style={{fontSize:10,color:T.inkSoft,fontWeight:800,textTransform:"uppercase"}}>Average deal value</div><div style={{fontSize:20,fontWeight:850,color:T.ink,marginTop:4}}>{money(avgDeal)}</div></div>{ins&&<div style={{background:"#F8FAFC",border:`1px solid ${T.line}`,borderRadius:11,padding:"10px 11px"}}><div style={{fontSize:10,fontWeight:850,color:T.inkSoft,textTransform:"uppercase",marginBottom:6}}>Manager view</div><div style={{display:"flex",gap:8,flexWrap:"wrap",fontSize:10.5,color:T.inkSoft}}><span>{Number(ins.followups_completed||0)} follow-ups</span><span>{Number(ins.followups_overdue||ins.overdue_followups||0)} overdue</span><span>{Number(ins.negotiations||0)} negotiations</span><span>{Number(ins.active_days||0)} active days</span></div></div>}</div>
        </div>}
      </div>})}</div>
      {!data.rows.length&&<EmptyReportState text="No employees found for this filter."/>}
    </>}
  </div>;
}

function FunnelReport({ leads }) {
  const total = leads.length;
  const counts = STATUSES.map((s) => ({ status: s, count: leads.filter((l) => l.status === s).length }));
  const maxCount = Math.max(1, ...counts.map((c) => c.count));

  if (total === 0) return <EmptyReportState text="No leads yet." />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {counts.map((c) => {
        const pctOfTotal = total ? Math.round((c.count / total) * 100) : 0;
        const barPct = Math.round((c.count / maxCount) * 100);
        return (
          <div key={c.status}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
              <span style={{ fontWeight: 600 }}>{STATUS_LABEL[c.status]}</span>
              <span style={{ color: T.inkSoft }}>{c.count} leads · {pctOfTotal}%</span>
            </div>
            <div style={{ height: 9, background: T.paperDeep, borderRadius: 11, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${barPct}%`, background: T.route, borderRadius: 11, transition: "width 0.3s ease" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RenewalsReport({ leads }) {
  const [days, setDays] = useState(30);
  const upcoming = leads.filter((l) =>
    (l.renewalDate && isWithinDays(new Date(l.renewalDate), days)) ||
    (!l.renewalDate && days >= 30 && isUpcomingRenewalMonth(l.renewalMonth))
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[30, 60, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            style={{ fontSize: 12.5, padding: "6px 12px", borderRadius: 8, cursor: "pointer", border: `1px solid ${days === d ? T.route : T.line}`, background: days === d ? T.route : "#fff", color: days === d ? "#fff" : T.ink, fontWeight: 600 }}
          >
            Next {d} days
          </button>
        ))}
      </div>
      {upcoming.length === 0 ? (
        <EmptyReportState text={`No renewals due in the next ${days} days.`} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {upcoming.map((l) => (
            <div key={l.id} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 11, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{l.business}</div>
                <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>{l.owner} · {l.phone}</div>
              </div>
              <div style={{ fontSize: 12.5, color: T.accent, fontWeight: 600, textAlign: "right" }}>
                {l.renewalDate || l.renewalMonth || "—"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PaymentDueReport({ salesmen }) {
  const [salesmanId, setSalesmanId] = useState("all");
  const [onlyPending, setOnlyPending] = useState(true);
  const [payments, setPayments] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [recordingFor, setRecordingFor] = useState(null); // the payment row being paid against
  const [expandedLeadId, setExpandedLeadId] = useState(null);
  const [sheetsInfo, setSheetsInfo] = useState(null);
  const [sheetsError, setSheetsError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(() => {
    setPayments(null);
    setError("");
    api.adminPayments({ salesmanId, onlyPending: onlyPending ? "true" : "" })
      .then((res) => { setPayments(res.payments || []); setSummary(res.summary || null); })
      .catch((err) => setError(err.message || "Couldn't load payments."));
  }, [salesmanId, onlyPending]);

  useEffect(() => { load(); window.addEventListener("fieldtrail:payments-updated",load); return()=>window.removeEventListener("fieldtrail:payments-updated",load); }, [load]);

  const exportParams = { salesmanId, onlyPending: onlyPending ? "true" : "" };

  return (
    <div>

      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginBottom: 16 }}>
          <StatCard label="Pending" value={fmtMoney(summary.pendingTotal)} icon={Wallet} color={T.danger} />
          <StatCard label="Collected this month" value={fmtMoney(summary.collectedThisMonth)} icon={CalendarClock} color={T.verified} />
          <StatCard label="Collected all time" value={fmtMoney(summary.collectedAllTime)} icon={CheckCircle2} color={T.route} />
          <StatCard label="Total deal value" value={fmtMoney(summary.dealValueTotal)} icon={TargetIcon} color={T.accent} />
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Select value={salesmanId} onChange={setSalesmanId} options={[["all", "All employees"], ...salesmen.map((s) => [s.id, s.name])]} />
          <button
            onClick={() => setOnlyPending((v) => !v)}
            style={{ fontSize: 12.5, padding: "6px 12px", borderRadius: 8, cursor: "pointer", border: `1px solid ${onlyPending ? T.route : T.line}`, background: onlyPending ? T.route : "#fff", color: onlyPending ? "#fff" : T.ink, fontWeight: 600 }}
          >
            {onlyPending ? "Showing pending only" : "Showing all Won deals"}
          </button>
        </div>
        <DownloadMenu
          onCsv={() => window.open(buildExportUrl("csv", exportParams, "payments"), "_blank")}
          onXlsx={() => window.open(buildExportUrl("xlsx", exportParams, "payments"), "_blank")}
          onPdf={() => window.open(buildExportUrl("pdf", exportParams, "payments"), "_blank")}
          onSheets={async () => {
            setSheetsError("");
            try {
              const info = await api.adminExportPaymentsSheetsInfo(exportParams);
              setSheetsInfo(info);
            } catch (err) {
              setSheetsError(err.message || "Couldn't prepare the Sheets export.");
            }
          }}
        />
      </div>
      <div style={{ position: "relative", marginBottom: 14 }}>
        <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: T.inkSoft }} />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by business, contact, or phone…"
          style={{ ...inputStyle, marginBottom: 0, width: "100%", padding: "9px 12px 9px 32px", boxSizing: "border-box" }}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", color: T.inkSoft }}>
            <X size={14} />
          </button>
        )}
      </div>
      {sheetsError && <div style={{ fontSize: 12, color: T.danger, marginBottom: 10 }}>{sheetsError}</div>}
      {sheetsInfo && (
        <div style={{ fontSize: 12, background: T.paperDeep, borderRadius: 11, padding: "10px 12px", marginBottom: 14 }}>
          No Google account is connected, so this can't push directly into a Sheet — but you can pull it in live:
          open a new Google Sheet, put this formula in cell A1, and re-enter it anytime to refresh:
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", background: "#fff", border: `1px solid ${T.line}`, borderRadius: 6, padding: "6px 8px", marginTop: 6, wordBreak: "break-all" }}>
            {sheetsInfo.importFormula}
          </div>
          <button onClick={() => { navigator.clipboard?.writeText(sheetsInfo.importFormula); }} style={{ marginTop: 8, fontSize: 11.5, fontWeight: 600, color: T.route, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            Copy formula
          </button>
        </div>
      )}
      {error && <div style={{ fontSize: 12.5, color: T.danger, marginBottom: 10 }}>{error}</div>}
      {payments === null && !error && (
        <div style={{ fontSize: 13, color: T.inkSoft, display: "flex", alignItems: "center", gap: 6 }}>
          <Loader2 size={14} className="spin" /> Loading…
        </div>
      )}
      {payments && payments.length === 0 && <EmptyReportState text={onlyPending ? "Nothing pending — everything's been paid." : "No Won deals with a deal value yet."} />}

      {(() => {
        const filteredPayments = (payments || []).filter(
          (p) => !searchQuery.trim() || [p.business, p.contactName, p.phone].some((f) => f && f.toLowerCase().includes(searchQuery.trim().toLowerCase()))
        );
        if (!payments || payments.length === 0) return null;
        if (filteredPayments.length === 0) return <EmptyReportState text="No payments match that search." />;
        return (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredPayments.map((p) => {
              const isExpanded = expandedLeadId === p.leadId;
              return (
                <div key={p.leadId} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{p.business}</div>
                      <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>{p.salesmanName} · {p.contactName} · {p.phone}</div>
                    </div>
                    {p.pending > 0 && (
                      <button
                        onClick={() => setRecordingFor(p)}
                        style={{ fontSize: 11.5, fontWeight: 700, padding: "6px 10px", borderRadius: 7, border: "none", background: T.route, color: "#fff", cursor: "pointer", whiteSpace: "nowrap" }}
                      >
                        Record payment
                      </button>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12.5 }}>
                    <div><span style={{ color: T.inkSoft }}>Total </span><span style={{ fontWeight: 700 }}>{fmtMoney(p.dealValue)}</span></div>
                    <div><span style={{ color: T.inkSoft }}>Paid </span><span style={{ fontWeight: 700, color: T.verified }}>{fmtMoney(p.paidTotal)}</span></div>
                    <div><span style={{ color: T.inkSoft }}>Pending </span><span style={{ fontWeight: 700, color: p.pending > 0 ? T.danger : T.verified }}>{fmtMoney(p.pending)}</span></div>
                  </div>
                  {p.paymentCount > 0 && (
                    <button
                      onClick={() => setExpandedLeadId(isExpanded ? null : p.leadId)}
                      style={{ marginTop: 10, fontSize: 11.5, fontWeight: 600, color: T.route, background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4 }}
                    >
                      {isExpanded ? "Hide" : "View"} {p.paymentCount} payment{p.paymentCount === 1 ? "" : "s"} {isExpanded ? "▲" : "▼"}
                    </button>
                  )}
                  {isExpanded && <PaymentHistoryList leadId={p.leadId} onChanged={load} />}
                </div>
              );
            })}
          </div>
        </>
        );
      })()}

      {recordingFor && (
        <RecordPaymentModal
          row={recordingFor}
          onClose={() => setRecordingFor(null)}
          onRecorded={() => { setRecordingFor(null); load(); }}
        />
      )}
    </div>
  );
}

function PaymentHistoryList({ leadId, onChanged }) {
  const [payments, setPayments] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // the payment being edited

  const load = useCallback(() => {
    api.adminLeadPayments(leadId).then((res) => setPayments(res.payments || [])).catch((err) => setError(err.message || "Couldn't load payment history."));
  }, [leadId]);

  useEffect(() => { load(); }, [load]);

  const del = async (paymentId) => {
    try {
      await api.adminDeletePayment(leadId, paymentId);
      load();
      onChanged();
    } catch (err) {
      setError(err.message || "Couldn't delete that payment.");
    }
  };

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.line}`, display: "flex", flexDirection: "column", gap: 6 }}>
      {error && <div style={{ fontSize: 11.5, color: T.danger }}>{error}</div>}
      {payments === null && !error && <div style={{ fontSize: 12, color: T.inkSoft }}>Loading…</div>}
      {payments && payments.map((p) => (
        <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 12 }}>
          <div>
            <span style={{ fontWeight: 700 }}>{fmtMoney(p.amount)}</span>
            <span style={{ color: T.inkSoft }}> · {new Date(p.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}{p.note ? ` · ${p.note}` : ""} · {p.recordedByName}</span>
          </div>
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <button onClick={() => setEditing(p)} style={{ background: "none", border: "none", cursor: "pointer", color: T.inkSoft, padding: 4 }} aria-label="Edit payment">
              <Pencil size={13} />
            </button>
            <button onClick={() => del(p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.inkSoft, padding: 4 }} aria-label="Delete payment">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}
      {editing && (
        <EditPaymentModal
          leadId={leadId}
          payment={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); onChanged(); }}
        />
      )}
    </div>
  );
}

function EditPaymentModal({ leadId, payment, onClose, onSaved }) {
  const [amount, setAmount] = useState(String(payment.amount));
  const [note, setNote] = useState(payment.note || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    const num = Number(amount);
    if (!num || num <= 0) { setError("Enter a valid amount."); return; }
    setSaving(true);
    setError("");
    try {
      await api.adminEditPayment(leadId, payment.id, { amount: num, note: note.trim() || undefined });
      onSaved();
    } catch (err) {
      setError(err.message || "Couldn't save that change.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Overlay title="Edit payment" onClose={onClose}>
      <form onSubmit={submit}>
        <label style={{ fontSize: 11.5, fontWeight: 600, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.3 }}>Amount</label>
        <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} autoFocus />
        <label style={{ fontSize: 11.5, fontWeight: 600, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.3 }}>Note (optional)</label>
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle} />
        {error && <div style={{ fontSize: 12, color: T.danger, marginBottom: 10 }}>{error}</div>}
        <button
          type="submit" disabled={saving}
          style={{ width: "100%", padding: "11px", borderRadius: 10, border: "none", background: T.route, color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </Overlay>
  );
}

function RecordPaymentModal({ row, onClose, onRecorded }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    const num = Number(amount);
    if (!num || num <= 0) { setError("Enter a valid amount."); return; }
    if (num > row.pending + 0.01) { setError(`That's more than the ${fmtMoney(row.pending)} still pending.`); return; }
    setSaving(true);
    setError("");
    try {
      await api.adminRecordPayment(row.leadId, { amount: num, note: note.trim() || undefined });
      onRecorded();
    } catch (err) {
      setError(err.message || "Couldn't record that payment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Overlay title={`Record payment — ${row.business}`} onClose={onClose}>
      <div style={{ fontSize: 12.5, color: T.inkSoft, marginBottom: 14 }}>
        {fmtMoney(row.pending)} pending of {fmtMoney(row.dealValue)} total.
      </div>
      <form onSubmit={submit}>
        <label style={{ fontSize: 11.5, fontWeight: 600, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.3 }}>Amount received</label>
        <input
          type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)}
          placeholder={`Up to ${row.pending}`} style={inputStyle} autoFocus
        />
        <label style={{ fontSize: 11.5, fontWeight: 600, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.3 }}>Note (optional)</label>
        <input
          type="text" value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. UPI, part payment" style={inputStyle}
        />
        {error && <div style={{ fontSize: 12, color: T.danger, marginBottom: 10 }}>{error}</div>}
        <button
          type="submit" disabled={saving}
          style={{ width: "100%", padding: "11px", borderRadius: 10, border: "none", background: T.route, color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? "Saving…" : "Record payment"}
        </button>
      </form>
    </Overlay>
  );
}

function ExpensesReport({ salesmen }) {
  const PAGE_SIZE = 12;
  const [category,setCategory]=useState("all"), [salesmanId,setSalesmanId]=useState("all"), [from,setFrom]=useState(""), [to,setTo]=useState("");
  const [expenses,setExpenses]=useState(null), [monthTotal,setMonthTotal]=useState(0), [error,setError]=useState(""), [visibleCount,setVisibleCount]=useState(PAGE_SIZE), [editing,setEditing]=useState(null);
  const isoDay=(value)=>String(value||"").match(/^(\d{4}-\d{2}-\d{2})/)?.[1]||"";
  const formatDate=(value)=>{const day=isoDay(value);if(!day)return String(value||"");const d=new Date(`${day}T12:00:00+05:30`);return new Intl.DateTimeFormat("en-IN",{day:"numeric",month:"short",year:"numeric",timeZone:"Asia/Kolkata"}).format(d)};
  const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const monthRange=(offset=0)=>{const now=new Date();const base=new Date(now.getFullYear(),now.getMonth()+offset,1,12);const y=base.getFullYear(),m=base.getMonth();const first=`${y}-${String(m+1).padStart(2,"0")}-01`;const last=offset===0?today():`${y}-${String(m+1).padStart(2,"0")}-${String(new Date(y,m+1,0).getDate()).padStart(2,"0")}`;return {from:first,to:last}};
  const load=useCallback(()=>{setExpenses(null);setError("");setVisibleCount(PAGE_SIZE);const current={category,salesmanId,from,to};Promise.all([api.adminExpenses(current),api.adminExpenses(monthRange(0))]).then(([res,month])=>{setExpenses(res.expenses||[]);setMonthTotal((month.expenses||[]).reduce((s,e)=>s+Number(e.amount||0),0))}).catch(err=>setError(err.message||"Couldn't load expenses."));},[category,salesmanId,from,to]);
  useEffect(()=>{load()},[load]);
  const del=async id=>{try{await api.adminDeleteExpense(id);load()}catch(err){setError(err.message||"Couldn't delete that expense.")}};
  const setRange=offset=>{const r=monthRange(offset);setFrom(r.from);setTo(r.to)};
  const total=(expenses||[]).reduce((s,e)=>s+Number(e.amount||0),0);
  const byCategory=(expenses||[]).reduce((a,e)=>{a[e.category]=(a[e.category]||0)+Number(e.amount||0);return a},{});
  const categoryRows=Object.entries(byCategory).sort((a,b)=>b[1]-a[1]); const maxCategory=Math.max(1,...categoryRows.map(([,v])=>v)); const top=categoryRows[0];
  const groups=[];(expenses||[]).slice(0,visibleCount).forEach(e=>{const d=isoDay(e.spentOn);const yesterday=new Date(Date.now()-86400000);const y=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(yesterday);const label=d===today()?"Today":d===y?"Yesterday":formatDate(d);let g=groups.find(x=>x.label===label);if(!g){g={label,rows:[]};groups.push(g)}g.rows.push(e)});
  return <div className="engage-expense-report">
    <div className="engage-expense-quick-filters"><span>Quick date</span><button type="button" onClick={()=>setRange(0)} className={from===monthRange(0).from&&to===monthRange(0).to?"is-active":""}>This month</button><button type="button" onClick={()=>setRange(-1)} className={from===monthRange(-1).from&&to===monthRange(-1).to?"is-active":""}>Last month</button><button type="button" onClick={()=>{setFrom("");setTo("")}}>All time</button></div>
    <div className="engage-expense-filters" style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:14}}>
      <Select value={category} onChange={setCategory} options={[["all","All categories"],...EXPENSE_CATEGORIES.map(c=>[c,c])]} />
      <Select value={salesmanId} onChange={setSalesmanId} options={[["all","All employees"],...salesmen.map(s=>[s.id,s.name])]} />
      <input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{...inputStyle,marginBottom:0,width:135}}/><span style={{fontSize:12,color:T.inkSoft}}>to</span><input type="date" value={to} onChange={e=>setTo(e.target.value)} style={{...inputStyle,marginBottom:0,width:135}}/>
    </div>
    {error&&<div style={{fontSize:12.5,color:T.danger,marginBottom:10}}>{error}</div>}
    {expenses===null&&!error&&<div style={{fontSize:13,color:T.inkSoft,display:"flex",alignItems:"center",gap:6}}><Loader2 size={14} className="spin"/> Loading…</div>}
    {expenses&&expenses.length===0&&<EmptyReportState text="No expenses recorded for these filters."/>}
    {expenses&&expenses.length>0&&<>
      <div className="engage-expense-summary"><div className="engage-expense-summary-card"><span>Total spend</span><strong>{fmtMoney(total)}</strong></div><div className="engage-expense-summary-card"><span>This month</span><strong>{fmtMoney(monthTotal)}</strong></div><div className="engage-expense-summary-card"><span>Top category</span><strong>{top?.[0]||"—"}</strong>{top&&<small>{fmtMoney(top[1])}</small>}</div><div className="engage-expense-summary-card"><span>Entries</span><strong>{expenses.length}</strong></div></div>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>{categoryRows.map(([cat,amt])=><div key={cat}><div style={{display:"flex",justifyContent:"space-between",fontSize:12.5,marginBottom:4}}><span style={{fontWeight:600}}>{cat}</span><span style={{color:T.inkSoft}}>{fmtMoney(amt)}</span></div><div style={{height:8,background:T.paperDeep,borderRadius:11,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.round(amt/maxCategory*100)}%`,background:T.danger,borderRadius:11}}/></div></div>)}</div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>{groups.map(group=><React.Fragment key={group.label}><div className="engage-expense-date-group">{group.label}</div>{group.rows.map(e=><div key={e.id} style={{background:T.card,border:`1px solid ${T.line}`,borderRadius:10,padding:"9px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}><div><div className="engage-expense-row-title" style={{fontSize:12.5,fontWeight:600}}>{e.category} · {fmtMoney(e.amount)}</div><div className="engage-expense-row-meta" style={{fontSize:11,color:T.inkSoft,marginTop:1}}>{formatDate(e.spentOn)}{e.salesmanName?` · ${e.salesmanName}`:""}{e.note?` · ${e.note}`:""}</div></div><div style={{display:"flex",gap:4}}><button onClick={()=>setEditing(e)} aria-label="Edit expense" style={{background:"none",border:"none",cursor:"pointer",color:T.inkSoft,padding:4}}><Pencil size={14}/></button><button onClick={()=>del(e.id)} aria-label="Delete expense" style={{background:"none",border:"none",cursor:"pointer",color:T.inkSoft,padding:4}}><Trash2 size={14}/></button></div></div>)}</React.Fragment>)}</div>
      {expenses.length>visibleCount&&<button type="button" className="engage-expense-load-more" onClick={()=>setVisibleCount(v=>v+PAGE_SIZE)}>Load more ({expenses.length-visibleCount} remaining)</button>}
    </>}
    {editing&&<ExpenseEditModal expense={editing} salesmen={salesmen} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);load()}}/>}
  </div>;
}

function ExpenseEditModal({ expense, salesmen, onClose, onSaved }) {
  const [form,setForm]=useState({category:expense.category||EXPENSE_CATEGORIES[0],amount:String(expense.amount||""),salesmanId:expense.salesmanId||"",spentOn:String(expense.spentOn||"").slice(0,10),note:expense.note||""});const [saving,setSaving]=useState(false),[error,setError]=useState("");
  const submit=async e=>{e.preventDefault();setSaving(true);setError("");try{await api.adminUpdateExpense(expense.id,{category:form.category,amount:Number(form.amount),salesmanId:form.salesmanId||null,spentOn:form.spentOn,note:form.note.trim()||null});onSaved()}catch(err){setError(err.message||"Could not update expense.");setSaving(false)}};
  return <Overlay title="Edit expense" onClose={onClose}><form onSubmit={submit}><Field label="Category"><Select value={form.category} onChange={v=>setForm(f=>({...f,category:v}))} options={EXPENSE_CATEGORIES.map(c=>[c,c])}/></Field><Field label="Amount"><input style={inputStyle} type="number" min="0.01" step="0.01" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/></Field><Field label="Employee"><Select value={form.salesmanId} onChange={v=>setForm(f=>({...f,salesmanId:v}))} options={[["","Not linked"],...salesmen.map(s=>[s.id,s.name])]}/></Field><Field label="Date"><input style={inputStyle} type="date" value={form.spentOn} onChange={e=>setForm(f=>({...f,spentOn:e.target.value}))}/></Field><Field label="Note"><textarea style={{...inputStyle,minHeight:70}} value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))}/></Field>{error&&<div style={{fontSize:12,color:T.danger,marginBottom:10}}>{error}</div>}<button disabled={saving} type="submit" style={{width:"100%",padding:11,borderRadius:10,border:0,background:T.route,color:"#fff",fontWeight:700}}>{saving?"Saving…":"Save changes"}</button></form></Overlay>;
}

function DailyActivityReport({ salesmen }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError("");
    api.adminReportDailyActivity({ date })
      .then((res) => { if (!cancelled) setData(res.salesmen || []); })
      .catch((err) => { if (!cancelled) setError(err.message || "Couldn't load activity."); });
    return () => { cancelled = true; };
  }, [date]);

  return (
    <div>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, marginBottom: 14, width: 180 }} />
      {error && <div style={{ fontSize: 12.5, color: T.danger, marginBottom: 10 }}>{error}</div>}
      {data === null && !error && (
        <div style={{ fontSize: 13, color: T.inkSoft, display: "flex", alignItems: "center", gap: 6 }}>
          <Loader2 size={14} className="spin" /> Loading…
        </div>
      )}
      {data && data.length === 0 && <EmptyReportState text="No salesmen found." />}
      {data && data.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.line}` }}>
                {["Employee", "Day started", "Visits", "Leads added", "Distance"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: T.inkSoft, fontWeight: 600, fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.3, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.salesmanId} style={{ borderBottom: `1px solid ${T.line}` }}>
                  <td style={{ padding: "9px 10px", fontWeight: 600 }}>{r.salesmanName}</td>
                  <td style={{ padding: "9px 10px", color: r.dayStarted ? T.ink : T.inkSoft }}>
                    {r.dayStarted ? new Date(r.dayStarted).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "Didn't start"}
                  </td>
                  <td style={{ padding: "9px 10px" }}>{r.visitCount}</td>
                  <td style={{ padding: "9px 10px" }}>{r.leadsCount}</td>
                  <td style={{ padding: "9px 10px" }}>{r.distanceKm.toFixed(1)} km</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TimeInStageReport() {
  const [stages, setStages] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api.adminReportTimeInStage()
      .then((res) => { if (!cancelled) setStages(res.stages || []); })
      .catch((err) => { if (!cancelled) setError(err.message || "Couldn't load this report."); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <div style={{ fontSize: 12.5, color: T.danger }}>{error}</div>;
  if (stages === null) {
    return (
      <div style={{ fontSize: 13, color: T.inkSoft, display: "flex", alignItems: "center", gap: 6 }}>
        <Loader2 size={14} className="spin" /> Loading…
      </div>
    );
  }
  if (stages.length === 0) return <EmptyReportState text="Not enough status changes yet to compute this." />;

  const maxDays = Math.max(1, ...stages.map((s) => s.avgDays));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {stages.map((s) => (
        <div key={s.status}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
            <span style={{ fontWeight: 600 }}>{STATUS_LABEL[s.status] || s.status}</span>
            <span style={{ color: T.inkSoft }}>{s.avgDays.toFixed(1)} days avg · {s.completedCount} leads</span>
          </div>
          <div style={{ height: 9, background: T.paperDeep, borderRadius: 11, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.round((s.avgDays / maxDays) * 100)}%`, background: T.danger, borderRadius: 11, transition: "width 0.3s ease" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function LeadExportReport({ salesmen }) {
  const [salesmanId, setSalesmanId] = useState("all");
  const [status, setStatus] = useState("all");
  const [date, setDate] = useState("");
  const [sheetsInfo, setSheetsInfo] = useState(null);
  const [sheetsError, setSheetsError] = useState("");

  return (
    <div>
      <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 14 }}>Exports the same 9 fields every time: business, sub location, POS name, renewal month/date, status, contact name, phone, and comments.</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <Select value={salesmanId} onChange={setSalesmanId} options={[["all", "All employees"], ...salesmen.map((s) => [s.id, s.name])]} />
        <Select value={status} onChange={setStatus} options={[["all", "All statuses"], ...STATUSES.map((s) => [s, STATUS_LABEL[s]])]} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
        {date && (
          <button onClick={() => setDate("")} style={{ fontSize: 11.5, color: T.inkSoft, background: "none", border: "none", cursor: "pointer" }}>Clear date</button>
        )}
      </div>
      {sheetsError && <div style={{ fontSize: 12, color: T.danger, marginBottom: 10 }}>{sheetsError}</div>}
      <DownloadMenu
        onCsv={() => window.open(buildExportUrl("csv", { salesmanId, status, date }), "_blank")}
        onXlsx={() => window.open(buildExportUrl("xlsx", { salesmanId, status, date }), "_blank")}
        onSheets={async () => {
          setSheetsError("");
          try {
            const info = await api.adminExportSheetsInfo({ salesmanId, status, date });
            setSheetsInfo(info);
          } catch (err) {
            setSheetsError(err.message || "Couldn't prepare the Sheets export.");
          }
        }}
      />
      {sheetsInfo && (
        <div style={{ marginTop: 12, fontSize: 12.5, color: T.inkSoft }}>
          <a href={sheetsInfo.url || sheetsInfo.sheetUrl} target="_blank" rel="noreferrer" style={{ color: T.route, fontWeight: 600 }}>Open in Google Sheets →</a>
        </div>
      )}
    </div>
  );
}

function LeadsBoardView({ leads, onStatusChange, onSelectLead, visibleStatus = "all" }) {
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverStatus, setDragOverStatus] = useState(null);

  const columns = STATUSES.filter((s) => visibleStatus === "all" || s === visibleStatus)
    .map((s) => ({ status: s, leads: leads.filter((l) => l.status === s) }));

  const handleDrop = (status) => {
    if (draggingId) {
      const lead = leads.find((l) => l.id === draggingId);
      if (lead && lead.status !== status) onStatusChange(draggingId, status);
    }
    setDraggingId(null);
    setDragOverStatus(null);
  };

  return (
    <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8 }}>
      {columns.map((col) => (
        <div
          key={col.status}
          onDragOver={(e) => { e.preventDefault(); setDragOverStatus(col.status); }}
          onDragLeave={() => setDragOverStatus((s) => (s === col.status ? null : s))}
          onDrop={(e) => { e.preventDefault(); handleDrop(col.status); }}
          style={{
            flex: "0 0 240px", background: dragOverStatus === col.status ? T.paperDeep : "transparent",
            border: `1.5px dashed ${dragOverStatus === col.status ? T.route : T.line}`, borderRadius: 12, padding: 8,
            display: "flex", flexDirection: "column", minHeight: 120, transition: "background 0.12s ease, border-color 0.12s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 4px 8px" }}>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>{STATUS_LABEL[col.status]}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft, background: T.paperDeep, borderRadius: 999, padding: "1px 7px" }}>{col.leads.length}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {col.leads.map((l) => (
              <div
                key={l.id}
                draggable
                onDragStart={() => setDraggingId(l.id)}
                onDragEnd={() => { setDraggingId(null); setDragOverStatus(null); }}
                onClick={() => onSelectLead(l)}
                style={{
                  background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: "9px 10px", cursor: "grab",
                  opacity: draggingId === l.id ? 0.4 : 1, boxShadow: "0 1px 2px rgba(20,20,30,0.05)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div aria-hidden="true" style={leadAvatarStyle(l.business)}>{leadInitials(l.business)}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 3 }}>{l.business}</div>
                    <div style={{ fontSize: 11, color: T.inkSoft }}>{l.salesmanName}</div>
                  </div>
                </div>
                {l.status === "won" && l.dealValue != null && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.verified, marginTop: 4, paddingLeft: 38 }}>{fmtMoney(l.dealValue)}</div>
                )}
              </div>
            ))}
            {col.leads.length === 0 && (
              <div style={{ fontSize: 11, color: T.inkSoft, textAlign: "center", padding: "14px 4px" }}>Drop here</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyReportState({ text }) {
  return <div style={{ fontSize: 13, color: T.inkSoft, textAlign: "center", padding: "30px 0" }}>{text}</div>;
}

const SALESMAN_REPORT_CARDS = [
  { key: "performance", title: "My performance", desc: "Your leads, conversion rate and target progress.", icon: Contact2, color: "#145C5D" },
  { key: "renewals", title: "Renewals due", desc: "Your leads renewing in the next 30, 60 or 90 days.", icon: CalendarClock, color: "#B8791F" },
];

function SalesmanReportsPage({ leads, dailyTarget, monthlyTarget }) {
  const [active, setActive] = useState(null);
  const activeCard = SALESMAN_REPORT_CARDS.find((c) => c.key === active);

  if (!active) {
    return (
      <div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Reports</div>
        <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 16 }}>Choose a report to view</div>
        <DayClosingReportsEntry />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {SALESMAN_REPORT_CARDS.map((c) => (
            <div
              key={c.key}
              onClick={() => setActive(c.key)}
              className="ft-card"
              style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 16, cursor: "pointer", boxShadow: "0 1px 2px rgba(20,20,30,0.04)" }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 9, background: `${c.color}1A`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                <c.icon size={17} color={c.color} />
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4 }}>{c.title}</div>
              <div style={{ fontSize: 12, color: T.inkSoft, lineHeight: 1.5 }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setActive(null)}
        style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: T.inkSoft, background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 16 }}
      >
        ← Back to reports
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
        {activeCard && <activeCard.icon size={18} color={activeCard.color} />}
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17 }}>{activeCard?.title}</div>
      </div>
      {active === "performance" && <MyPerformanceReport leads={leads} dailyTarget={dailyTarget} monthlyTarget={monthlyTarget} />}
      {active === "renewals" && <RenewalsReport leads={leads} />}
    </div>
  );
}

function MyPerformanceReport({ leads = [] }) {
  const now = new Date();
  const monthKey = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit"}).format(now) + "-01";
  const [data,setData]=useState(null);
  const [error,setError]=useState("");
  useEffect(()=>{let live=true;api.myPerformance(monthKey).then(v=>{if(live){setData(v);setError("")}}).catch(e=>{if(live)setError(e.message||"Couldn't load performance.")});return()=>{live=false}},[monthKey]);

  const monthLabel = now.toLocaleDateString("en-IN",{month:"long",year:"numeric",timeZone:"Asia/Kolkata"});
  const end = data?.end_day ? new Date(`${String(data.end_day).slice(0,10)}T23:59:59+05:30`) : new Date(now.getFullYear(),now.getMonth()+1,0);
  const daysLeft = Math.max(0,Math.ceil((end-now)/86400000));
  const pct=(v,t)=>t>0?Math.round((Number(v||0)/Number(t))*100):0;
  const bar=(v,t)=>Math.min(100,pct(v,t));
  const won=Number(data?.won||0), wonTarget=Number(data?.won_target||0);
  const sales=Number(data?.sales_value||0), salesTarget=Number(data?.sales_value_target||0);
  const monthLeads=leads.filter(l=>isThisMonth(l.createdAt));
  const monthWon=monthLeads.filter(l=>l.status==="won").length;
  const conversion=monthLeads.length?Math.round((monthWon/monthLeads.length)*100):0;
  const wonRemaining=Math.max(0,wonTarget-won), salesRemaining=Math.max(0,salesTarget-sales);

  if(error) return <div style={{padding:14,border:`1px solid ${T.line}`,borderRadius:12,color:T.danger,fontSize:13}}>{error}</div>;
  if(!data) return <div style={{padding:18,color:T.inkSoft,fontSize:13}}>Loading your performance…</div>;

  const Progress=({label,value,target,remaining,money=false})=><div style={{marginTop:label==="Deals Won"?0:22}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:12,marginBottom:8}}>
      <div>
        <div style={{fontSize:12,color:"rgba(255,255,255,.72)",marginBottom:3}}>{label}</div>
        <div style={{fontSize:22,fontWeight:800,letterSpacing:"-.3px"}}>{money?fmtMoney(value):value} <span style={{fontSize:13,fontWeight:600,opacity:.7}}>/ {money?fmtMoney(target):target}</span></div>
      </div>
      <div style={{fontSize:17,fontWeight:800}}>{pct(value,target)}%</div>
    </div>
    <div style={{height:8,borderRadius:99,background:"rgba(255,255,255,.16)",overflow:"hidden"}}>
      <div style={{height:"100%",width:`${bar(value,target)}%`,borderRadius:99,background:"#fff",transition:"width .3s ease"}}/>
    </div>
    <div style={{fontSize:11.5,marginTop:7,color:"rgba(255,255,255,.78)"}}>
      {target<=0 ? "No target set for this month" : remaining<=0 ? "Target achieved ✓" : money ? `${fmtMoney(remaining)} remaining` : `${remaining} more ${remaining===1?"deal":"deals"} to reach your target`}
    </div>
  </div>;

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:10,marginBottom:12}}>
      <div>
        <div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:17,fontWeight:800,color:T.ink}}>MY PERFORMANCE</div>
        <div style={{fontSize:12.5,color:T.inkSoft,marginTop:2}}>{monthLabel}</div>
      </div>
      <div style={{fontSize:11.5,fontWeight:700,color:T.route,background:"#EAF5F0",borderRadius:999,padding:"5px 9px"}}>{daysLeft} days left</div>
    </div>
    <div className="ft-card" style={{background:"linear-gradient(145deg,#123F3D 0%,#17635C 100%)",color:"#fff",borderRadius:17,padding:"18px 17px 17px",boxShadow:"0 10px 26px rgba(18,63,61,.16)"}}>
      <div style={{fontSize:10.5,fontWeight:800,letterSpacing:.8,opacity:.65,marginBottom:16}}>YOUR MONTH</div>
      <Progress label="Deals Won" value={won} target={wonTarget} remaining={wonRemaining}/>
      <Progress label="Sales" value={sales} target={salesTarget} remaining={salesRemaining} money/>
    </div>

    <div style={{marginTop:16}}>
      <div style={{fontSize:10.5,fontWeight:800,letterSpacing:.65,color:T.inkSoft,marginBottom:8}}>THIS MONTH</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",background:"#fff",border:`1px solid ${T.line}`,borderRadius:13,overflow:"hidden"}}>
        {[
          ["Leads",monthLeads.length],
          ["Won",monthWon],
          ["Conversion",`${conversion}%`]
        ].map(([label,value],i)=><div key={label} style={{padding:"13px 8px",textAlign:"center",borderLeft:i?`1px solid ${T.line}`:"none"}}>
          <div style={{fontSize:18,fontWeight:800,color:T.ink}}>{value}</div>
          <div style={{fontSize:10.5,color:T.inkSoft,marginTop:3}}>{label}</div>
        </div>)}
      </div>
    </div>
  </div>;
}


function SalesmanLeadsModal({ salesman, leads, onClose, onSelectLead }) {
  const [briefLead, setBriefLead] = useState(null);
  const [tab, setTab] = useState("all");
  const mine = leads.filter((l) => l.salesmanId === salesman.id);

  const groups = {
    all: mine,
    hot: mine.filter((l) => l.status === "hot"),
    negotiation: mine.filter((l) => l.status === "negotiation"),
    cold: mine.filter((l) => l.status === "cold"),
    converted: mine.filter((l) => l.status === "won"),
    pending: mine.filter((l) => !["won", "lost"].includes(l.status)),
  };
  const TABS = [
    ["all", "All"], ["hot", "🔥 Hot"], ["negotiation", "Negotiation"], ["cold", "Cold"],
    ["converted", "Won"], ["pending", "Pending"],
  ];
  const shown = groups[tab];

  return (
    <Overlay onClose={onClose} title={`${salesman.name}'s Leads`}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: "6px 12px", borderRadius: 8, border: `1px solid ${tab === key ? T.route : T.line}`,
              background: tab === key ? T.route : "#fff", color: tab === key ? "#fff" : T.ink,
              fontWeight: 700, fontSize: 12, cursor: "pointer",
            }}
          >
            {label} ({groups[key].length})
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {shown.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: T.inkSoft, fontSize: 13, padding: "30px 8px" }}>
            <List size={22} style={{ opacity: 0.5 }} />
            No leads in this category.
          </div>
        )}
        {shown.map((l) => (
          <div key={l.id} className="ft-row" onClick={() => onSelectLead(l)} style={{ border: `1px solid ${T.line}`, borderRadius: 11, padding: 10, background: "#fff", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div aria-hidden="true" style={leadAvatarStyle(l.business)}>{leadInitials(l.business)}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, minWidth: 0, overflowWrap: "anywhere" }}>{l.business}</div>
                  <button type="button" className="ft-lead-brief-pill" aria-label={`Brief for ${l.business}`} onClick={event => { event.stopPropagation(); setBriefLead(l); }}><Sparkles size={11} /> Brief</button>
                </div>
                <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 3, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span>{STATUS_LABEL[l.status]} · {fmtTime(l.createdAt)}{l.dealValue != null ? ` · ${fmtMoney(l.dealValue)}` : ""}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {briefLead && <LeadBriefPopup key={briefLead.id} lead={briefLead} buildBrief={buildLeadBrief} onClose={() => setBriefLead(null)} />}
    </Overlay>
  );
}


// Draws a salesman's GPS trail for a chosen day: a polyline through every
// location ping, start/end markers, and that day's lead pins along the way.
function SalesmanRouteModal({ salesman, onClose }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    setError("");
    api.adminSalesmanHistory(salesman.id, date)
      .then((res) => setData(res))
      .catch((err) => setError(err.message || "Couldn't load the route for this day."))
      .finally(() => setLoading(false));
  }, [salesman.id, date]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: [26.847, 80.975], zoom: 12, scrollWheelZoom: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    mapRef.current = map;
    // Leaflet needs a nudge to size correctly inside a modal that just mounted.
    setTimeout(() => map.invalidateSize(), 50);
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !data) return;
    if (layerRef.current) { layerRef.current.remove(); layerRef.current = null; }

    const group = L.layerGroup().addTo(map);
    layerRef.current = group;

    const points = data.route.map((p) => [p.latitude, p.longitude]);
    if (points.length > 0) {
      L.polyline(points, { color: T.route, weight: 3, opacity: 0.75 }).addTo(group);
      L.circleMarker(points[0], { radius: 7, color: "#fff", weight: 2, fillColor: T.verified, fillOpacity: 1 })
        .bindTooltip("Start", { permanent: false }).addTo(group);
      L.circleMarker(points[points.length - 1], { radius: 7, color: "#fff", weight: 2, fillColor: T.danger, fillOpacity: 1 })
        .bindTooltip("Last known", { permanent: false }).addTo(group);
    }

    data.leads.forEach((l) => {
      if (l.latitude == null || l.longitude == null) return;
      L.marker([l.latitude, l.longitude], {
        icon: L.divIcon({
          className: "",
          html: `<div style="width:12px;height:12px;border-radius:50%;background:${l.verification_status === "verified" ? T.verified : T.warn};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35);"></div>`,
          iconSize: [12, 12], iconAnchor: [6, 6],
        }),
      }).bindTooltip(l.business_name, { direction: "top", offset: [0, -6] }).addTo(group);
    });

    const allPoints = [...points, ...data.leads.filter((l) => l.latitude != null).map((l) => [l.latitude, l.longitude])];
    if (allPoints.length > 0) {
      map.fitBounds(L.latLngBounds(allPoints), { padding: [30, 30], maxZoom: 15 });
    }
  }, [data]);

  return (
    <Overlay onClose={onClose} title={`${salesman.name}'s Route`}>
      <div style={{ marginBottom: 12 }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
      </div>
      {error && <div style={{ fontSize: 12.5, color: T.danger, background: T.dangerSoft, borderRadius: 11, padding: "8px 10px", marginBottom: 12 }}>{error}</div>}
      <div ref={containerRef} style={{ width: "100%", height: 320, borderRadius: 11, background: T.paperDeep }} />
      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.inkSoft, marginTop: 8 }}>
          <Loader2 size={13} className="spin" /> Loading route…
        </div>
      )}
      {!loading && data && data.route.length === 0 && (
        <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 10 }}>No location pings recorded for this day.</div>
      )}
      {!loading && data && data.route.length > 0 && (
        <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 10, display: "flex", gap: 14, flexWrap: "wrap" }}>
          <span><span style={{ color: T.verified, fontWeight: 700 }}>●</span> Start ({fmtTime(new Date(data.route[0].captured_at))})</span>
          <span><span style={{ color: T.danger, fontWeight: 700 }}>●</span> Last known ({fmtTime(new Date(data.route[data.route.length - 1].captured_at))})</span>
          <span>{data.leads.length} lead{data.leads.length === 1 ? "" : "s"} that day</span>
        </div>
      )}
      {!loading && <AttendanceSummary attendance={data?.attendance} date={date} />}
    </Overlay>
  );
}

// Day Start / Day End: when, and where (as a tappable maps link), plus
// total hours worked — computed live if the day hasn't ended yet.
function AttendanceSummary({ attendance, date }) {
  if (!attendance || !attendance.start_day_at) {
    return (
      <div style={{ fontSize: 12.5, color: T.inkSoft, background: T.paperDeep, borderRadius: 11, padding: "10px 12px", marginTop: 14 }}>
        No "Start Day" recorded for this date.
      </div>
    );
  }

  const start = new Date(attendance.start_day_at);
  const end = attendance.end_day_at ? new Date(attendance.end_day_at) : null;
  const isToday = date === new Date().toISOString().slice(0, 10);
  const durationMs = (end || (isToday ? new Date() : start)) - start;
  const hours = Math.floor(durationMs / 3600000);
  const mins = Math.round((durationMs % 3600000) / 60000);

  const mapsLink = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;

  return (
    <div style={{ marginTop: 14, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", color: T.inkSoft, fontWeight: 700, letterSpacing: 0.4, marginBottom: 10 }}>Attendance</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11.5, color: T.inkSoft }}>Day started</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{fmtTime(start)}</div>
          {attendance.start_lat != null && (
            <a href={mapsLink(attendance.start_lat, attendance.start_lng)} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: T.route, fontWeight: 600 }}>
              View location ↗
            </a>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11.5, color: T.inkSoft }}>{end ? "Day ended" : isToday ? "Still active" : "Not ended"}</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{end ? fmtTime(end) : "—"}</div>
          {attendance.end_lat != null && (
            <a href={mapsLink(attendance.end_lat, attendance.end_lng)} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: T.route, fontWeight: 600 }}>
              View location ↗
            </a>
          )}
        </div>
      </div>
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.line}`, fontSize: 13, fontWeight: 700, color: T.ink }}>
        Total: {hours}h {mins}m {!end && isToday ? "(so far)" : ""}
      </div>
    </div>
  );
}


function MessageComposeModal({ salesman, onClose, onSend }) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    if (!salesman) { setHistoryLoading(false); return; } // broadcast target has no single history to show
    setHistoryLoading(true);
    try {
      const res = await api.adminGetMessages(salesman.id);
      setHistory(res.messages || []);
    } catch {
      /* history is a nice-to-have — send still works even if this fails */
    } finally {
      setHistoryLoading(false);
    }
  }, [salesman]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleSend = async () => {
    if (!body.trim()) return;
    setSending(true);
    setError("");
    try {
      await onSend(body.trim());
      setBody("");
      await loadHistory();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send this message.");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id) => {
    setHistory((prev) => prev.filter((m) => m.id !== id)); // optimistic
    try {
      await api.adminDeleteMessage(id);
    } catch {
      loadHistory(); // reconcile if it actually failed
    }
  };

  return (
    <Overlay onClose={onClose} title={salesman ? `Messages — ${salesman.name}` : "Message all salesmen"}>
      {salesman && (
        <>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: T.inkSoft, fontWeight: 700, letterSpacing: 0.4, marginBottom: 8 }}>Sent history</div>
          {historyLoading ? (
            <div style={{ fontSize: 12.5, color: T.inkSoft, marginBottom: 14 }}>Loading…</div>
          ) : history.length === 0 ? (
            <div style={{ fontSize: 12.5, color: T.inkSoft, marginBottom: 14 }}>No messages sent yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16, maxHeight: 220, overflowY: "auto" }}>
              {history.map((m) => (
                <div key={m.id} style={{ padding: "10px 12px", borderRadius: 11, background: "#fff", border: `1px solid ${T.line}` }}>
                  <div style={{ fontSize: 13, color: T.ink, whiteSpace: "pre-wrap" }}>{m.body}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                    <span style={{ fontSize: 10.5, color: T.inkSoft }}>
                      {fmtTime(new Date(m.created_at))} {m.read_at ? "· Read" : "· Unread"}
                    </span>
                    <button
                      onClick={() => handleDelete(m.id)}
                      style={{ border: "none", background: "none", cursor: "pointer", color: T.inkSoft, padding: 0, display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}
                      title="Delete message"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Field label="New message / task">
        <textarea style={{ ...inputStyle, minHeight: 90 }} value={body} onChange={(e) => setBody(e.target.value)} placeholder="e.g. Please prioritize Gomti Nagar leads today" />
      </Field>
      {error && <div style={{ fontSize: 12.5, color: T.danger, background: T.dangerSoft, borderRadius: 11, padding: "8px 10px", marginBottom: 12 }}>{error}</div>}
      <button
        disabled={!body.trim() || sending}
        onClick={handleSend}
        style={{ width: "100%", padding: 12, borderRadius: 11, border: "none", cursor: body.trim() ? "pointer" : "not-allowed", background: body.trim() ? T.route : "#C7CDD6", color: "#fff", fontWeight: 700, fontSize: 14.5 }}
      >
        {sending ? "Sending…" : "Send"}
      </button>
    </Overlay>
  );
}


  return { DataQualityReport, SalesmanPerformanceReport, FunnelReport, RenewalsReport, PaymentDueReport, PaymentHistoryList, EditPaymentModal, RecordPaymentModal, ExpensesReport, ExpenseEditModal, DailyActivityReport, TimeInStageReport, LeadExportReport, LeadsBoardView, EmptyReportState, SalesmanReportsPage, MyPerformanceReport, SalesmanLeadsModal, SalesmanRouteModal, AttendanceSummary, MessageComposeModal };
}
