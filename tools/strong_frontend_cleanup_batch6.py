from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
on_path=ROOT/'src'/'Onboarding.jsx'; api_path=ROOT/'src'/'api.js'; main_path=ROOT/'src'/'main.jsx'
on=on_path.read_text(); api=api_path.read_text(); main=main_path.read_text()

# Add direct API route: no global fetch interception.
anchor="  onboardingSummary: id => request(`/onboarding/${id}/summary`),\n"
if anchor not in api: raise SystemExit('onboarding summary API anchor missing')
if 'onboardingShareLink:' not in api:
    api=api.replace(anchor,anchor+"  onboardingShareLink: id => request(`/onboarding/${id}/share-link`, {method:'POST'}),\n",1)
api_path.write_text(api)

# Add live-share state and handler using the selected onboarding id.
state=" const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[summary,setSummary]=useState(null),[phone,setPhone]=useState('');\n"
new_state=" const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[summary,setSummary]=useState(null),[phone,setPhone]=useState(''),[liveShare,setLiveShare]=useState(null);\n"
if state not in on: raise SystemExit('Onboarding state anchor missing')
on=on.replace(state,new_state,1)
share_anchor=" const share=async()=>{if(busy)return;setBusy(true);setError('');try{const r=await api.onboardingSummary(selected);setSummary(r.summary);const number=r.summary.phone.replace(/\\D/g,'');setPhone(number.length===10?'91'+number:number)}catch(e){setError(e.message)}finally{setBusy(false)}};\n"
share_handler=share_anchor+" const shareLive=async()=>{if(busy||!selected)return;setBusy(true);setError('');try{const r=await api.onboardingShareLink(selected);const number=String(r.phone||'').replace(/\\D/g,'');const normalized=number.length===10?'91'+number:number;const text=`Hi, you can track ${r.businessName||record?.business_name||'your restaurant'}'s onboarding progress here:\\n${r.shareUrl}\\n\\nCurrent progress: ${r.completed||0} of ${r.total||0} completed.`;setLiveShare({...r,whatsapp:`https://wa.me/${normalized}?text=${encodeURIComponent(text)}`})}catch(e){setError(e.message)}finally{setBusy(false)}};\n"
if share_anchor not in on: raise SystemExit('Onboarding share handler anchor missing')
on=on.replace(share_anchor,share_handler,1)

# Reset live share when changing customer/record.
on=on.replace("setSelected(customer.id);setSummary(null)","setSelected(customer.id);setSummary(null);setLiveShare(null)",1)
on=on.replace("if(summary)setSummary(null);else{setSelected(null);setRecord(null)}setError('')","if(summary)setSummary(null);else{setSelected(null);setRecord(null);setLiveShare(null)}setError('')",1)

progress='''<progress value={completed} max={record.steps.length} aria-label="Onboarding completion"/><div className="ft-ob-muted" role="status">{completed} of {record.steps.length} completed</div>\n <button type="button" onClick={()=>window.dispatchEvent(new CustomEvent('fieldtrail:open-collections',{detail:{key:'lead:'+selected}}))}>View customer payments</button>'''
progress_new='''<progress value={completed} max={record.steps.length} aria-label="Onboarding completion"/><div className="ft-ob-muted" role="status">{completed} of {record.steps.length} completed</div>\n <div className="ft-ob-live-share-addon">\n   <button type="button" className="ft-ob-primary ft-ob-live-share-button" disabled={busy} onClick={shareLive}>{busy?'Preparing…':'Share live progress'}</button>\n   <p className="ft-ob-muted" style={{margin:'7px 0 0'}}>Share anytime. The customer sees the latest read-only checklist progress.</p>\n   {liveShare&&<div className="ft-ob-live-share-result">\n     <p className="ft-ob-muted">{liveShare.completed||0} of {liveShare.total||0} completed · Customer sees a read-only live checklist. Internal notes are hidden.</p>\n     <input className="ft-ob-live-link ft-ob-live-link-desktop" readOnly value={liveShare.shareUrl||''} aria-label="Customer progress link"/>\n     <div className="ft-ob-live-link-row"><button type="button" className="ft-ob-live-copy" onClick={()=>navigator.clipboard?.writeText(liveShare.shareUrl||'')}>Copy link</button><a className="ft-ob-primary ft-ob-live-whatsapp" href={liveShare.whatsapp} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a></div>\n   </div>}\n </div>\n <button type="button" onClick={()=>window.dispatchEvent(new CustomEvent('fieldtrail:open-collections',{detail:{key:'lead:'+selected}}))}>View customer payments</button>'''
if progress not in on: raise SystemExit('Onboarding progress anchor missing')
on=on.replace(progress,progress_new,1)

# Stage is an actual step property in the React editor now.
row='''<section className="ft-ob-settings-card"><div className="ft-ob-settings-card-head"><div><span className="ft-ob-settings-kicker">PROCESS</span><h3>Checklist</h3><p>Set the steps your team follows for every new onboarding. Stage is optional.</p></div><span className="ft-ob-settings-count">{steps.length} steps</span></div><div className="ft-ob-settings-steps">{steps.map((step,index)=><div className="ft-ob-edit" key={step.id}><label><span>Step {index+1}</span><input required maxLength={160} value={step.title} disabled={busy} onChange={e=>setSteps(s=>s.map(v=>v.id===step.id?{...v,title:e.target.value}:v))}/></label><div className="ft-ob-actions">'''
row_new='''<section className="ft-ob-settings-card"><div className="ft-ob-settings-card-head"><div><span className="ft-ob-settings-kicker">PROCESS</span><h3>Checklist</h3><p>Set the steps your team follows for every new onboarding. Stage is optional.</p></div><span className="ft-ob-settings-count">{steps.length} steps</span></div><div className="ft-ob-settings-steps">{steps.map((step,index)=><div className="ft-ob-edit" key={step.id}><label><span>Step {index+1}</span><input required maxLength={160} value={step.title} disabled={busy} onChange={e=>setSteps(s=>s.map(v=>v.id===step.id?{...v,title:e.target.value}:v))}/></label><label className="ft-ob-stage-field">Stage (optional)<select value={step.stage||''} disabled={busy} onChange={e=>setSteps(s=>s.map(v=>v.id===step.id?{...v,stage:e.target.value}:v))}><option value="">No stage</option><option value="setup">Setup</option><option value="training">Training</option><option value="go_live">Go Live</option></select></label><div className="ft-ob-actions">'''
if row not in on: raise SystemExit('Onboarding editor row anchor missing')
on=on.replace(row,row_new,1)
on=on.replace("{id:crypto.randomUUID(),title:''}","{id:crypto.randomUUID(),title:'',stage:''}")
on_path.write_text(on)

main=main.replace('import "./onboardingLiveShare.js";\n','')
main_path.write_text(main)
print('Batch 6 applied')
