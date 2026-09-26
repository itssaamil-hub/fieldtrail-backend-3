import React,{useEffect,useState} from 'react';
import {getApiBase,getSession} from './api.js';

async function locationRequest(path,opts={}){
  const base=getApiBase();
  if(!base) throw new Error('No backend configured yet.');
  const token=getSession()?.token||'';
  const res=await fetch(`${base}${path}`,{
    ...opts,
    headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{}) ,...(opts.headers||{})},
  });
  let data=null;try{data=await res.json()}catch{}
  if(!res.ok) throw new Error(data?.error||`Request failed (${res.status})`);
  return data;
}

const defaults={gpsLocation:true,locationMandatoryForNewLead:true,continuousGpsTracking:true,version:0};

function PolicySwitch({label,description,checked,disabled,onChange}){
  return <label className="ft-q-check" style={{display:'flex',alignItems:'flex-start',gap:10,padding:'11px 0',cursor:disabled?'not-allowed':'pointer',borderBottom:'1px solid #edf1ef',opacity:disabled?.5:1}}>
    <input type="checkbox" role="switch" checked={!!checked} disabled={disabled} onChange={e=>onChange(e.target.checked)}/>
    <span style={{display:'block',minWidth:0}}><span style={{display:'block',fontSize:13,fontWeight:750,color:'#1f2c28'}}>{label} — <strong>{checked?'ON':'OFF'}</strong></span><span style={{display:'block',marginTop:3,fontSize:11.5,lineHeight:1.45,color:'#6f7a75'}}>{description}</span></span>
  </label>;
}

export default function EmployeeLocationSettings({employeeId}){
  const [policy,setPolicy]=useState(null);
  const [draft,setDraft]=useState(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');

  useEffect(()=>{
    let live=true;
    setLoading(true);setError('');setMessage('');
    locationRequest(`/admin/employees/${employeeId}/location-policy`).then(data=>{if(!live)return;const next={...defaults,...data};setPolicy(next);setDraft(next)}).catch(e=>{if(live)setError(e.message||'Could not load location settings.')}).finally(()=>{if(live)setLoading(false)});
    return()=>{live=false};
  },[employeeId]);

  const dirty=!!policy&&!!draft&&['gpsLocation','locationMandatoryForNewLead','continuousGpsTracking'].some(k=>!!policy[k]!==!!draft[k]);
  const change=(key,value)=>{
    setMessage('');setError('');
    setDraft(current=>{
      const next={...(current||defaults),[key]:value};
      if(key==='gpsLocation'&&!value){next.locationMandatoryForNewLead=false;next.continuousGpsTracking=false;}
      return next;
    });
  };
  const save=async()=>{
    if(!dirty){setMessage('No changes to save.');return;}
    setSaving(true);setError('');setMessage('');
    try{
      const saved=await locationRequest(`/admin/employees/${employeeId}/location-policy`,{method:'PUT',body:JSON.stringify({gpsLocation:!!draft.gpsLocation,locationMandatoryForNewLead:!!draft.locationMandatoryForNewLead,continuousGpsTracking:!!draft.continuousGpsTracking,version:policy.version})});
      const next={...defaults,...saved};setPolicy(next);setDraft(next);setMessage('Location settings saved.');
    }catch(e){setError(e.message||'Could not save location settings.')}finally{setSaving(false)}
  };

  return <div className="ft-q-box" style={{marginTop:14}}>
    <h3 style={{margin:'0 0 4px'}}>Location &amp; Tracking</h3>
    <p className="ft-ob-muted" style={{marginTop:0}}>Control GPS and live tracking for this employee only.</p>
    {loading&&<p className="ft-ob-muted">Loading location policy…</p>}
    {error&&<p role="alert" style={{color:'#b42318'}}>{error}</p>}
    {draft&&!loading&&<>
      <PolicySwitch label="GPS Location" description="If off, leads can be saved with no location at all." checked={draft.gpsLocation} disabled={saving} onChange={v=>change('gpsLocation',v)}/>
      <PolicySwitch label="Location Mandatory for New Lead" description="When GPS is on, location must be captured before a new lead can be saved." checked={draft.locationMandatoryForNewLead} disabled={saving||!draft.gpsLocation} onChange={v=>change('locationMandatoryForNewLead',v)}/>
      <PolicySwitch label="Continuous GPS Tracking" description="Sends live location pings only while this employee's day is active." checked={draft.continuousGpsTracking} disabled={saving||!draft.gpsLocation} onChange={v=>change('continuousGpsTracking',v)}/>
      <button type="button" className="ft-ob-primary" style={{marginTop:10}} disabled={saving} onClick={save}>{saving?'Saving…':'Save Location Settings'}</button>
      <div role="status" style={{fontSize:11.5,marginTop:8,minHeight:18,color:message==='Location settings saved.'?'#12805C':'#6f7a75'}}>{message}</div>
    </>}
  </div>;
}
