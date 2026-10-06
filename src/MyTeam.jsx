import React,{useEffect,useState} from 'react';
import {api} from './api.js';
import {OnboardingDialog} from './Onboarding.jsx';

const fmtTime=value=>value?new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(value)):'—';

export default function MyTeam({onClose}){
  const [team,setTeam]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [selected,setSelected]=useState(null),[brief,setBrief]=useState(null),[briefLoading,setBriefLoading]=useState(false);

  useEffect(()=>{let live=true;setLoading(true);api.salesmanTeam().then(r=>{if(live){setTeam(r.team||[]);setError('')}}).catch(e=>{if(live)setError(e.message||"Couldn't load your team.")}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[]);

  const openBrief=async employee=>{
    setSelected(employee);setBrief(null);setBriefLoading(true);setError('');
    try{setBrief(await api.salesmanTeamBrief(employee.id));}
    catch(e){setError(e.message||"Couldn't load employee brief.");}
    finally{setBriefLoading(false);}
  };

  return <OnboardingDialog title={selected?`${selected.full_name} · Daily Brief`:'My Team'} onClose={selected?()=>{setSelected(null);setBrief(null);setError('')}:onClose} wide>
    <div className="ft-q">
      {error&&<p role="alert" className="ft-ob-error">{error}</p>}
      {!selected&&<>
        <p className="ft-ob-muted">Employees assigned directly to you. You can view their current work status and Daily Brief.</p>
        {loading?<p role="status">Loading team…</p>:team.length===0?<p>No employees are assigned to you yet.</p>:team.map(employee=><div className="ft-q-box" key={employee.id} style={{marginBottom:10}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}}>
            <div><strong>{employee.full_name}</strong><div className="ft-ob-muted" style={{marginTop:3}}>{[employee.region,employee.area,employee.employee_code].filter(Boolean).join(' · ')||'No region assigned'}</div></div>
            <span className="ft-ob-badge">{employee.is_active===false?'Inactive':employee.status==='online'?'Working':'Offline'}</span>
          </div>
          <div className="ft-ob-muted" style={{marginTop:8}}>Start Day {fmtTime(employee.start_day_at)}{employee.end_day_at?` · End Day ${fmtTime(employee.end_day_at)}`:''}</div>
          <button type="button" style={{marginTop:10}} onClick={()=>openBrief(employee)}>View Daily Brief</button>
        </div>)}
      </>}
      {selected&&<>
        {briefLoading?<p role="status">Loading brief…</p>:brief&&<div className="ft-q-box">
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:8}}>
            <div><strong>{brief.glance?.leadsAdded||0}</strong><div className="ft-ob-muted">Leads</div></div>
            <div><strong>{brief.followUpHealth?.dueToday||0}</strong><div className="ft-ob-muted">Follow-ups</div></div>
            <div><strong>{brief.unfinished?.pendingTasks||0}</strong><div className="ft-ob-muted">Pending tasks</div></div>
          </div>
          <div className="ft-ob-muted" style={{marginTop:12}}>This is read-only manager visibility. Admin permissions and company settings remain unavailable.</div>
        </div>}
      </>}
    </div>
  </OnboardingDialog>;
}
