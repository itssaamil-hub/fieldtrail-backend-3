import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  Flame,
  Handshake,
  ListChecks,
  MapPin,
  MessageSquare,
  RefreshCw,
  Settings,
  ShieldAlert,
  Target,
  UserPlus,
} from 'lucide-react';
import { api } from './api.js';

const C = {
  ink:'#1A1D23', soft:'#6B7280', line:'#E7E9EE', card:'#FFFFFF',
  green:'#12805C', red:'#D94A4A', blue:'#2563EB', purple:'#8B5CF6', amber:'#D97706', teal:'#145C5D'
};

const metricDefs = [
  { key:'leadsCreated', label:'Leads Created', color:C.green, Icon:Target },
  { key:'movedHot', label:'Moved Hot', color:C.red, Icon:Flame },
  { key:'movedNegotiation', label:'Negotiation', color:C.blue, Icon:Handshake },
  { key:'won', label:'Won', color:C.purple, Icon:CheckCircle2 },
  { key:'followupsDone', label:'Follow-ups Done', color:C.amber, Icon:CalendarDays },
];

const moduleTone = {
  Lead:['#EAF2FF','#2563EB'],
  Task:['#EEF8F7','#0F766E'],
  Attendance:['#E8F7EF','#14805E'],
  Employee:['#EEF2FF','#4F46E5'],
  Onboarding:['#FFF3E8','#C96A18'],
  Message:['#EEF7FA','#0E7490'],
  Settings:['#F2F4F7','#475467'],
  Quotation:['#F2ECFF','#7C3AED'],
  Payment:['#EAF8EE','#15803D'],
  Activity:['#F2F4F7','#475467'],
  'Data Health':['#FDECEC','#D92D20'],
  System:['#FDECEC','#D92D20'],
};

const moduleIcons = {
  Lead: UserPlus,
  Task: ListChecks,
  Attendance: ClipboardCheck,
  Employee: Activity,
  Onboarding: CheckCircle2,
  Message: MessageSquare,
  Settings,
  Quotation: FileText,
  Payment: CircleDollarSign,
  Activity,
  'Data Health': ShieldAlert,
  System: ShieldAlert,
};

function fmtDay(day) {
  const d = new Date(`${day}T00:00:00`);
  return d.toLocaleDateString('en-IN', { day:'numeric', month:'short' });
}
function fmtTime(value) {
  return new Date(value).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
}
function initials(name='') {
  return name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase() || '?';
}

function SparkChart({ rows, activeKeys, days }) {
  const w=Math.max(760, rows.length*42),h=300,left=42,right=18,top=18,bottom=34;
  const values = rows.flatMap(r => activeKeys.map(k => Number(r[k]||0)));
  const max = Math.max(4, ...values);
  const yMax = Math.ceil(max/4)*4;
  const x = i => left + (rows.length<=1?0:i*(w-left-right)/(rows.length-1));
  const y = v => top + (h-top-bottom) * (1 - Number(v||0)/yMax);
  const grid = [0,.25,.5,.75,1].map(p => Math.round(yMax*p));
  const labelEvery = days === 30 ? 4 : days === 15 ? 2 : 1;
  return <div style={{width:'100%',overflowX:'auto',marginTop:4}}>
    <svg viewBox={`0 0 ${w} ${h}`} style={{width:days===30?'auto':'100%',minWidth:days===30?920:620,height:300,display:'block'}} role="img" aria-label={`${days} day lead activity chart`}>
      {grid.map(v => <g key={v}><line x1={left} x2={w-right} y1={y(v)} y2={y(v)} stroke="#EDEFF2" strokeWidth="1"/><text x={left-10} y={y(v)+4} textAnchor="end" fontSize="10" fill="#98A2B3">{v}</text></g>)}
      {rows.map((r,i)=> (i%labelEvery===0 || i===rows.length-1) ? <text key={r.day} x={x(i)} y={h-9} textAnchor="middle" fontSize="10.5" fill="#667085">{fmtDay(r.day)}</text> : null)}
      {metricDefs.filter(m=>activeKeys.includes(m.key)).map(m=>{
        const pts=rows.map((r,i)=>`${x(i)},${y(r[m.key])}`).join(' ');
        return <g key={m.key}>
          <polyline fill="none" stroke={m.color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" points={pts}/>
          {rows.map((r,i)=><circle key={r.day} cx={x(i)} cy={y(r[m.key])} r="3.2" fill="#fff" stroke={m.color} strokeWidth="2"><title>{`${fmtDay(r.day)} · ${m.label}: ${r[m.key]}`}</title></circle>)}
        </g>;
      })}
    </svg>
  </div>;
}

export default function AdminActivityOverview({ salesmen=[] }) {
  const [salesmanId,setSalesmanId]=useState('all');
  const [days,setDays]=useState(7);
  const [data,setData]=useState(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [activeKeys,setActiveKeys]=useState(['leadsCreated','movedHot','movedNegotiation','won','followupsDone']);

  useEffect(()=>{
    let alive=true;
    setLoading(true); setError('');
    api.adminActivityOverview({ salesmanId, days })
      .then(v=>{ if(alive) setData(v); })
      .catch(e=>{ if(alive) setError(e.message || 'Could not load activity.'); })
      .finally(()=>{ if(alive) setLoading(false); });
    const timer=setInterval(()=>{
      api.adminActivityOverview({ salesmanId, days }).then(v=>{ if(alive) setData(v); }).catch(()=>{});
    },60000);
    return()=>{alive=false;clearInterval(timer);};
  },[salesmanId,days]);

  const person = salesmanId==='all' ? 'All employees' : (salesmen.find(s=>s.id===salesmanId)?.name || 'Employee');
  const totals=data?.totals||{};
  const rows=data?.trend||[];
  const activities=data?.activities||[];
  const toggle=k=>setActiveKeys(prev=>prev.includes(k)?(prev.length===1?prev:prev.filter(x=>x!==k)):[...prev,k]);
  const periodLabel = days===30 ? '1 Month' : `${days} Days`;

  return <div style={{display:'grid',gridTemplateColumns:'minmax(0,1.24fr) minmax(420px,1fr)',gap:14,marginBottom:18}} className="engage-activity-overview">
    <style>{`@media(max-width:1100px){.engage-activity-overview{grid-template-columns:minmax(0,1.12fr) minmax(390px,1fr)!important}} @media(max-width:920px){.engage-activity-overview{grid-template-columns:1fr!important}.engage-activity-feed{max-height:none!important}}`}</style>

    <section style={{background:C.card,border:`1px solid ${C.line}`,borderRadius:16,padding:16,minWidth:0,boxShadow:'0 1px 2px rgba(15,23,42,.03)'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',marginBottom:10,flexWrap:'wrap'}}>
        <div style={{minWidth:220}}><div style={{fontSize:16,fontWeight:800,color:C.ink}}>Lead Activity — Last {periodLabel}</div><div style={{fontSize:12,color:C.soft,marginTop:3}}>Real activity recorded in Engage · {person}</div></div>
        <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap',justifyContent:'flex-end'}}>
          <select aria-label="Activity period" value={days} onChange={e=>setDays(Number(e.target.value))} style={{height:34,border:`1px solid ${C.line}`,borderRadius:9,background:'#fff',color:C.ink,fontSize:11.5,fontWeight:650,padding:'0 28px 0 9px'}}>
            <option value={7}>7 Days</option>
            <option value={15}>15 Days</option>
            <option value={30}>1 Month</option>
          </select>
          <select aria-label="Activity employee" value={salesmanId} onChange={e=>setSalesmanId(e.target.value)} style={{height:34,border:`1px solid ${C.line}`,borderRadius:9,background:'#fff',color:C.ink,fontSize:11.5,fontWeight:650,padding:'0 28px 0 9px'}}>
            <option value="all">All Employees</option>
            {salesmen.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div style={{height:34,padding:'0 9px',border:`1px solid ${C.line}`,borderRadius:9,background:'#F8FBFA',fontSize:11.2,color:C.soft,display:'flex',alignItems:'center',gap:6,whiteSpace:'nowrap'}}>{loading?<><RefreshCw size={12} className="spin"/> Refreshing</>:<><span style={{width:7,height:7,borderRadius:'50%',background:C.green}}/> Live data</>}</div>
        </div>
      </div>

      {error ? <div style={{padding:'18px 4px',fontSize:12.5,color:'#B42318'}}>{error}</div> : <>
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,minmax(82px,1fr))',gap:6,overflowX:'auto',paddingBottom:0}}>
          {metricDefs.map(m=>{
            const on=activeKeys.includes(m.key); const Icon=m.Icon;
            return <button key={m.key} onClick={()=>toggle(m.key)} style={{minWidth:82,textAlign:'left',padding:'6px 8px',borderRadius:9,border:`1px solid ${on?m.color+'55':C.line}`,background:on?`${m.color}0D`:'#fff',cursor:'pointer'}}>
              <div style={{display:'flex',alignItems:'center',gap:4,fontSize:9.2,fontWeight:750,color:C.soft,whiteSpace:'nowrap'}}><Icon size={11.5} color={m.color}/>{m.label}</div>
              <div style={{fontSize:17,fontWeight:850,color:C.ink,marginTop:2,lineHeight:1.05}}>{Number(totals[m.key]||0)}</div>
            </button>;
          })}
        </div>
        {rows.length ? <SparkChart rows={rows} activeKeys={activeKeys} days={days}/> : !loading && <div style={{padding:'72px 12px',textAlign:'center',color:C.soft,fontSize:12.5}}>No lead activity recorded in this period.</div>}
      </>}
    </section>

    <section style={{background:C.card,border:`1px solid ${C.line}`,borderRadius:16,padding:'15px 0 0',minWidth:0,boxShadow:'0 1px 2px rgba(15,23,42,.03)',overflow:'hidden'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,padding:'0 14px 11px'}}>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:C.ink}}>Activity Centre</div>
          <div style={{fontSize:12,color:C.soft,marginTop:3}}>Latest activities across your team · {person}</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:7}}>
          <span style={{fontSize:10.5,fontWeight:800,color:C.teal,background:'#EAF4F2',padding:'5px 8px',borderRadius:999}}>LIVE</span>
          <span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,fontWeight:750,color:C.teal,background:'#F5FAF9',border:'1px solid #DCECE8',padding:'6px 8px',borderRadius:8}}>Latest <ArrowRight size={12}/></span>
        </div>
      </div>

      <div className="engage-activity-feed" style={{maxHeight:350,overflowY:'auto',borderTop:`1px solid ${C.line}`}}>
        {error ? <div style={{padding:16,fontSize:12.5,color:'#B42318'}}>{error}</div> : activities.length ? activities.map((a,i)=>{
          const [bg,fg]=moduleTone[a.module]||moduleTone.Activity;
          const Icon=moduleIcons[a.module]||Activity;
          return <div key={a.id} style={{display:'grid',gridTemplateColumns:'34px 58px 32px 70px minmax(0,1fr) auto 18px',gap:8,alignItems:'center',padding:'9px 12px',borderTop:i?`1px solid ${C.line}`:'none',minHeight:58}}>
            <div style={{width:30,height:30,borderRadius:8,background:bg,color:fg,display:'grid',placeItems:'center'}}><Icon size={15}/></div>
            <div style={{fontSize:10.5,color:'#8A94A3',whiteSpace:'nowrap'}}>{fmtTime(a.createdAt)}</div>
            <div style={{width:30,height:30,borderRadius:'50%',background:'#E9EDF6',color:'#566481',display:'grid',placeItems:'center',fontSize:9.5,fontWeight:850}}>{initials(a.actorName)}</div>
            <div style={{fontSize:10.9,fontWeight:750,color:'#475467',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{a.actorName}</div>
            <div style={{minWidth:0}}>
              <div style={{fontSize:11.9,fontWeight:800,color:C.ink,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{a.title}</div>
              <div style={{fontSize:10.8,color:C.soft,marginTop:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{a.detail || 'Recorded in Engage'}</div>
            </div>
            <span style={{fontSize:9.7,fontWeight:800,color:fg,background:bg,padding:'5px 7px',borderRadius:7,whiteSpace:'nowrap'}}>{a.module}</span>
            <ChevronRight size={15} color="#A9B1BD"/>
          </div>;
        }) : !loading ? <div style={{padding:'38px 16px',textAlign:'center',fontSize:12.5,color:C.soft}}>No recorded activity yet.</div> : <div style={{padding:'38px 16px',textAlign:'center',fontSize:12.5,color:C.soft}}>Loading activity…</div>}
      </div>

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 12px',borderTop:`1px solid ${C.line}`,background:'#FBFCFD'}}>
        <div style={{display:'flex',alignItems:'center',gap:5,fontSize:10.5,color:C.soft}}><MapPin size={12}/> Recorded CRM events only</div>
        <div style={{fontSize:10.5,color:C.soft}}>Auto-refreshes every minute</div>
      </div>
    </section>
  </div>;
}
