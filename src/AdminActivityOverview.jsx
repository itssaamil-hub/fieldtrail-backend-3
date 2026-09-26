import React, { useEffect, useState } from 'react';
import { Activity, ArrowRight, CalendarDays, CheckCircle2, Flame, Handshake, RefreshCw, Target } from 'lucide-react';
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
  Lead:['#EAF2FF','#2563EB'], Task:['#F3E8FF','#7C3AED'], Attendance:['#E8F7EF','#14805E'],
  Employee:['#EEF2FF','#4F46E5'], Onboarding:['#FFF3E8','#C96A18'], Message:['#EEF7FA','#0E7490'],
  Settings:['#F2F4F7','#475467'], Quotation:['#F2ECFF','#7C3AED'], Payment:['#EAF8EE','#15803D'], Activity:['#F2F4F7','#475467']
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

function SparkChart({ rows, activeKeys }) {
  const w=760,h=230,left=42,right=18,top=18,bottom=34;
  const values = rows.flatMap(r => activeKeys.map(k => Number(r[k]||0)));
  const max = Math.max(4, ...values);
  const yMax = Math.ceil(max/4)*4;
  const x = i => left + (rows.length<=1?0:i*(w-left-right)/(rows.length-1));
  const y = v => top + (h-top-bottom) * (1 - Number(v||0)/yMax);
  const grid = [0,.25,.5,.75,1].map(p => Math.round(yMax*p));
  return <div style={{width:'100%',overflowX:'auto'}}>
    <svg viewBox={`0 0 ${w} ${h}`} style={{width:'100%',minWidth:620,height:230,display:'block'}} role="img" aria-label="Seven day lead activity chart">
      {grid.map(v => <g key={v}><line x1={left} x2={w-right} y1={y(v)} y2={y(v)} stroke="#EDEFF2" strokeWidth="1"/><text x={left-10} y={y(v)+4} textAnchor="end" fontSize="10" fill="#98A2B3">{v}</text></g>)}
      {rows.map((r,i)=><text key={r.day} x={x(i)} y={h-10} textAnchor="middle" fontSize="10.5" fill="#667085">{fmtDay(r.day)}</text>)}
      {metricDefs.filter(m=>activeKeys.includes(m.key)).map(m=>{
        const pts=rows.map((r,i)=>`${x(i)},${y(r[m.key])}`).join(' ');
        return <g key={m.key}>
          <polyline fill="none" stroke={m.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={pts}/>
          {rows.map((r,i)=><circle key={r.day} cx={x(i)} cy={y(r[m.key])} r="3.4" fill="#fff" stroke={m.color} strokeWidth="2"><title>{`${fmtDay(r.day)} · ${m.label}: ${r[m.key]}`}</title></circle>)}
        </g>;
      })}
    </svg>
  </div>;
}

export default function AdminActivityOverview({ salesmen=[] }) {
  const [salesmanId,setSalesmanId]=useState('all');
  const [data,setData]=useState(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [activeKeys,setActiveKeys]=useState(['leadsCreated','movedHot','movedNegotiation','won','followupsDone']);

  useEffect(()=>{
    let alive=true;
    setLoading(true); setError('');
    api.adminActivityOverview({ salesmanId })
      .then(v=>{ if(alive) setData(v); })
      .catch(e=>{ if(alive) setError(e.message || 'Could not load activity.'); })
      .finally(()=>{ if(alive) setLoading(false); });
    const timer=setInterval(()=>{
      api.adminActivityOverview({ salesmanId }).then(v=>{ if(alive) setData(v); }).catch(()=>{});
    },60000);
    return()=>{alive=false;clearInterval(timer);};
  },[salesmanId]);

  const person = salesmanId==='all' ? 'All employees' : (salesmen.find(s=>s.id===salesmanId)?.name || 'Employee');
  const totals=data?.totals||{};
  const rows=data?.trend||[];
  const activities=data?.activities||[];
  const toggle=k=>setActiveKeys(prev=>prev.includes(k)?(prev.length===1?prev:prev.filter(x=>x!==k)):[...prev,k]);

  return <div style={{display:'grid',gridTemplateColumns:'minmax(0,1.72fr) minmax(320px,.9fr)',gap:14,marginBottom:18}} className="engage-activity-overview">
    <style>{`@media(max-width:920px){.engage-activity-overview{grid-template-columns:1fr!important}.engage-activity-feed{max-height:none!important}}`}</style>
    <section style={{background:C.card,border:`1px solid ${C.line}`,borderRadius:16,padding:16,minWidth:0,boxShadow:'0 1px 2px rgba(15,23,42,.03)'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',marginBottom:12,flexWrap:'wrap'}}>
        <div><div style={{fontSize:16,fontWeight:800,color:C.ink}}>Lead Activity — Last 7 Days</div><div style={{fontSize:12,color:C.soft,marginTop:3}}>Real activity recorded in Engage · {person}</div></div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <select aria-label="Activity employee" value={salesmanId} onChange={e=>setSalesmanId(e.target.value)} style={{height:34,border:`1px solid ${C.line}`,borderRadius:9,background:'#fff',color:C.ink,fontSize:11.5,fontWeight:650,padding:'0 28px 0 9px'}}>
            <option value="all">All Employees</option>
            {salesmen.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div style={{fontSize:11.5,color:C.soft,display:'flex',alignItems:'center',gap:6}}>{loading?<><RefreshCw size={12} className="spin"/> Refreshing</>:<><Activity size={12}/> Live CRM data</>}</div>
        </div>
      </div>

      {error ? <div style={{padding:'18px 4px',fontSize:12.5,color:'#B42318'}}>{error}</div> : <>
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,minmax(105px,1fr))',gap:8,overflowX:'auto',paddingBottom:2}}>
          {metricDefs.map(m=>{
            const on=activeKeys.includes(m.key); const Icon=m.Icon;
            return <button key={m.key} onClick={()=>toggle(m.key)} style={{minWidth:105,textAlign:'left',padding:'10px 11px',borderRadius:11,border:`1px solid ${on?m.color+'55':C.line}`,background:on?`${m.color}0D`:'#fff',cursor:'pointer'}}>
              <div style={{display:'flex',alignItems:'center',gap:6,fontSize:10.5,fontWeight:750,color:C.soft}}><Icon size={13} color={m.color}/>{m.label}</div>
              <div style={{fontSize:21,fontWeight:850,color:C.ink,marginTop:5}}>{Number(totals[m.key]||0)}</div>
            </button>;
          })}
        </div>
        {rows.length ? <SparkChart rows={rows} activeKeys={activeKeys}/> : !loading && <div style={{padding:'48px 12px',textAlign:'center',color:C.soft,fontSize:12.5}}>No lead activity recorded in this period.</div>}
      </>}
    </section>

    <section style={{background:C.card,border:`1px solid ${C.line}`,borderRadius:16,padding:'15px 0 6px',minWidth:0,boxShadow:'0 1px 2px rgba(15,23,42,.03)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,padding:'0 14px 10px'}}>
        <div><div style={{fontSize:16,fontWeight:800,color:C.ink}}>Activity Centre</div><div style={{fontSize:12,color:C.soft,marginTop:3}}>Latest recorded activity · {person}</div></div>
        <span style={{fontSize:10.5,fontWeight:800,color:C.teal,background:'#EAF4F2',padding:'5px 8px',borderRadius:999}}>LIVE</span>
      </div>
      <div className="engage-activity-feed" style={{maxHeight:316,overflowY:'auto',borderTop:`1px solid ${C.line}`}}>
        {error ? <div style={{padding:16,fontSize:12.5,color:'#B42318'}}>{error}</div> : activities.length ? activities.map((a,i)=>{
          const [bg,fg]=moduleTone[a.module]||moduleTone.Activity;
          return <div key={a.id} style={{display:'grid',gridTemplateColumns:'54px 30px minmax(0,1fr) auto',gap:8,alignItems:'center',padding:'10px 12px',borderTop:i?`1px solid ${C.line}`:'none'}}>
            <div style={{fontSize:10.5,color:'#8A94A3'}}>{fmtTime(a.createdAt)}</div>
            <div style={{width:28,height:28,borderRadius:'50%',background:'#EEF1F7',color:'#53627D',display:'grid',placeItems:'center',fontSize:9.5,fontWeight:800}}>{initials(a.actorName)}</div>
            <div style={{minWidth:0}}><div style={{fontSize:11.8,fontWeight:800,color:C.ink,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{a.title}</div><div style={{fontSize:10.8,color:C.soft,marginTop:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{a.actorName}{a.detail?` · ${a.detail}`:''}</div></div>
            <span style={{fontSize:9.5,fontWeight:800,color:fg,background:bg,padding:'4px 6px',borderRadius:6,whiteSpace:'nowrap'}}>{a.module}</span>
          </div>;
        }) : !loading ? <div style={{padding:'34px 16px',textAlign:'center',fontSize:12.5,color:C.soft}}>No recorded activity yet.</div> : <div style={{padding:'34px 16px',textAlign:'center',fontSize:12.5,color:C.soft}}>Loading activity…</div>}
      </div>
      <div style={{display:'flex',justifyContent:'flex-end',padding:'8px 12px 4px',fontSize:10.5,color:C.soft}}>Only recorded CRM events are shown <ArrowRight size={12} style={{marginLeft:5}}/></div>
    </section>
  </div>;
}
