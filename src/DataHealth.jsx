import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, RefreshCw, X } from 'lucide-react';
import { getApiBase, getSession } from './api.js';

const pretty = value => String(value || '').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase());
const fmtDate = value => { try { return value ? new Date(value).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}) : '—'; } catch { return String(value||'—'); } };
async function get(path){
  const base=getApiBase(), token=getSession()?.token;
  if(!base||!token) throw new Error('Admin session or backend URL is missing.');
  const r=await fetch(`${base}${path}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
  let data=null; try{data=await r.json()}catch{}
  if(!r.ok) throw new Error(data?.error||`Request failed (${r.status})`);
  return data;
}

function status(check){
  if(check.ok) return {label:'Healthy',tone:'good',Icon:CheckCircle2};
  if(check.severity==='critical') return {label:'Critical',tone:'critical',Icon:AlertTriangle};
  return {label:'Warning',tone:'warning',Icon:AlertTriangle};
}

function DetailRows({ checkKey }){
  const [data,setData]=useState(null), [error,setError]=useState('');
  useEffect(()=>{let live=true;get(`/admin/data-health/details/${encodeURIComponent(checkKey)}`).then(v=>live&&setData(v)).catch(e=>live&&setError(e.message));return()=>{live=false}},[checkKey]);
  if(error) return <div style={{padding:12,color:'#C0392B'}}>{error}</div>;
  if(!data) return <div style={{padding:12,color:'#6B7280'}}>Loading affected records…</div>;
  if(!(data.rows||[]).length) return <div style={{padding:12,color:'#6B7280'}}>No affected records found.</div>;
  return <div>{data.rows.map((row,i)=><div key={i} style={{padding:'11px 12px',borderTop:i?'1px solid #E7E9EE':'none',background:'#fff'}}><strong style={{fontSize:11}}>Record {i+1}</strong><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:'7px 12px',marginTop:7}}>{Object.entries(row).filter(([,v])=>v!==null).map(([k,v])=><div key={k}><div style={{fontSize:9,textTransform:'uppercase',fontWeight:800,color:'#6B7280'}}>{pretty(k)}</div><div style={{fontSize:11.5,marginTop:2,wordBreak:'break-word'}}>{/_at$|time|started|finished|updated/.test(k)&&typeof v==='string'?fmtDate(v):typeof v==='boolean'?(v?'Yes':'No'):String(v)}</div></div>)}</div></div>)}{data.limited&&<div style={{padding:9,fontSize:10.5,color:'#6B7280'}}>Showing first 50 affected records.</div>}</div>;
}

export default function DataHealth({ onClose }){
  const [data,setData]=useState(null), [error,setError]=useState(''), [loading,setLoading]=useState(true);
  const [tab,setTab]=useState('issues'), [category,setCategory]=useState('all'), [query,setQuery]=useState(''), [expanded,setExpanded]=useState(null);
  const load=()=>{setLoading(true);setError('');get('/admin/data-health').then(setData).catch(e=>setError(e.message)).finally(()=>setLoading(false));};
  useEffect(()=>{load();},[]);
  useEffect(()=>{const key=e=>e.key==='Escape'&&onClose();document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key)},[onClose]);
  const checks=data?.checks||[];
  const categories=useMemo(()=>[...new Set(checks.map(c=>c.category||'Other'))],[checks]);
  const visible=checks.filter(c=>(tab==='all'||!c.ok)&&(category==='all'||(c.category||'Other')===category)&&(!query.trim()||`${c.title||pretty(c.key)} ${c.why||''}`.toLowerCase().includes(query.trim().toLowerCase())));
  const critical=Number(data?.summary?.critical||0), warnings=Number(data?.summary?.warning||0), healthy=checks.filter(c=>c.ok).length;
  return <div onMouseDown={e=>e.target===e.currentTarget&&onClose()} style={{position:'fixed',inset:0,zIndex:100000,background:'rgba(17,24,39,.48)',display:'flex',alignItems:'center',justifyContent:'center',padding:18,boxSizing:'border-box'}}>
    <div role="dialog" aria-modal="true" aria-label="Data Health" style={{width:'min(900px,100%)',maxHeight:'90vh',background:'#F4F5F7',borderRadius:20,boxShadow:'0 30px 90px rgba(0,0,0,.25)',display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <header style={{display:'flex',justifyContent:'space-between',gap:12,padding:'16px 18px',background:'#fff',borderBottom:'1px solid #E7E9EE'}}><div><div style={{fontSize:17,fontWeight:900}}>Data Health <span style={{fontSize:9,color:'#145C5D',background:'#E7F1F1',borderRadius:999,padding:'3px 6px'}}>Control Centre</span></div><div style={{fontSize:11.5,color:'#6B7280',marginTop:3}}>Live integrity, consistency and system checks for Engage</div></div><div style={{display:'flex',gap:8}}><button onClick={load} disabled={loading} style={{border:'1px solid #E7E9EE',background:'#fff',borderRadius:9,padding:'7px 10px',fontWeight:800}}><RefreshCw size={13}/> Refresh</button><button onClick={onClose} aria-label="Close" style={{width:32,height:32,border:'1px solid #E7E9EE',background:'#fff',borderRadius:9}}><X size={16}/></button></div></header>
      <div style={{padding:16,overflow:'auto'}}>
        {loading&&<div style={{padding:35,textAlign:'center',color:'#6B7280'}}>Running backend integrity checks…</div>}
        {error&&<div style={{padding:14,borderRadius:12,background:'#FBEAE8',color:'#C0392B',fontWeight:700}}>{error}</div>}
        {data&&!loading&&<>
          <div style={{padding:'15px 16px',borderRadius:15,background:critical?'#FBEAE8':warnings?'#FDF3E0':'#E6F6EF',marginBottom:12}}><strong style={{color:critical?'#C0392B':warnings?'#B8791F':'#12805C'}}>{critical?'Critical data issues found':warnings?'Backend healthy with warnings':'Everything looks healthy'}</strong><div style={{fontSize:11.5,color:'#6B7280',marginTop:3}}>Checked {fmtDate(data.checkedAt)}</div></div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:8,marginBottom:12}}>{[['Checks',checks.length],['Healthy',healthy],['Critical records',critical],['Warning records',warnings]].map(([l,v])=><div key={l} style={{background:'#fff',border:'1px solid #E7E9EE',borderRadius:12,padding:11}}><div style={{fontSize:9,textTransform:'uppercase',fontWeight:800,color:'#6B7280'}}>{l}</div><div style={{fontSize:20,fontWeight:900,marginTop:3}}>{v}</div></div>)}</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',marginBottom:10}}><button onClick={()=>setTab('issues')} aria-pressed={tab==='issues'}>Needs attention ({checks.filter(c=>!c.ok).length})</button><button onClick={()=>setTab('all')} aria-pressed={tab==='all'}>All checks ({checks.length})</button><button onClick={()=>setTab('system')} aria-pressed={tab==='system'}>System</button>{tab!=='system'&&<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search checks…" style={{marginLeft:'auto',border:'1px solid #E7E9EE',borderRadius:9,padding:'7px 9px'}}/>}</div>
          {tab==='system'?<div style={{background:'#fff',border:'1px solid #E7E9EE',borderRadius:14,overflow:'hidden'}}><div style={{padding:12,fontWeight:800}}>Scheduled jobs</div>{(data.system?.jobs||[]).map((j,i)=><div key={j.job_key||i} style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,padding:12,borderTop:'1px solid #E7E9EE',fontSize:11}}><strong>{pretty(j.job_key)}</strong><span>{fmtDate(j.last_success)}</span><span>{fmtDate(j.last_attempt)}</span></div>)}</div>:<>
            <div style={{display:'flex',gap:5,overflowX:'auto',marginBottom:9}}><button onClick={()=>setCategory('all')}>All</button>{categories.map(c=><button key={c} onClick={()=>setCategory(c)}>{c}</button>)}</div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>{visible.map(check=>{const s=status(check), Icon=s.Icon;return <div key={check.key} style={{border:'1px solid #E7E9EE',borderRadius:14,background:check.ok?'#fff':s.tone==='critical'?'#FBEAE8':'#FDF3E0',overflow:'hidden'}}><div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 13px'}}><Icon size={18}/><div style={{flex:1}}><strong style={{fontSize:12.5}}>{check.title||pretty(check.key)}</strong><div style={{fontSize:10.8,color:'#6B7280',marginTop:2}}>{check.why||'Backend integrity check'}</div></div><div style={{fontWeight:900}}>{check.ok?'OK':Number(check.count||0)} <small>{s.label}</small></div></div>{!check.ok&&check.detailsAvailable&&<div style={{padding:'0 13px 12px'}}><button onClick={()=>setExpanded(expanded===check.key?null:check.key)}>{expanded===check.key?'Hide records':'View affected records →'}</button>{expanded===check.key&&<div style={{marginTop:8,border:'1px solid #E7E9EE',borderRadius:10,overflow:'hidden'}}><DetailRows checkKey={check.key}/></div>}</div>}</div>})}</div>
          </>}
        </>}
      </div>
    </div>
  </div>;
}
