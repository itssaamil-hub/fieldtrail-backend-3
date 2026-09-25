import { getApiBase, getSession } from './api.js';

let observer = null;
let queued = false;
const policyCache = new Map();

function authHeaders(){
  const token=getSession()?.token||'';
  return {'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})};
}
async function request(path,opts={}){
  const base=getApiBase();
  const res=await fetch(`${base}${path}`,{...opts,headers:{...authHeaders(),...(opts.headers||{})}});
  let data=null;try{data=await res.json()}catch{}
  if(!res.ok) throw new Error(data?.error||`Request failed (${res.status})`);
  return data;
}
function text(node){return (node?.textContent||'').replace(/\s+/g,' ').trim();}
function visible(node){
  if(!node||!node.isConnected||node.closest('[hidden]')) return false;
  const s=getComputedStyle(node);return s.display!=='none'&&s.visibility!=='hidden'&&node.getClientRects().length>0;
}
function exactTextNode(label,root=document){
  return [...root.querySelectorAll('div,span,label,p,h1,h2,h3,h4')].find(n=>visible(n)&&text(n)===label)||null;
}

// GPS policy is employee-specific now. The legacy global Location Settings
// controls still exist in App.jsx for compatibility, so hide only those exact
// four sibling rows. Never hide an ancestor/modal: doing that can make the
// whole CRM Settings dialog disappear.
function removeGlobalLocationSettings(){
  const heading=exactTextNode('Location Settings');
  if(!heading||heading.dataset.engageGlobalLocationHeading==='true') return;

  const expected=[
    'GPS Location',
    'Location Mandatory for New Lead',
    'Continuous GPS Tracking',
  ];
  const rows=[];
  let node=heading.nextElementSibling;
  for(const label of expected){
    if(!node||!text(node).startsWith(label)) return;
    rows.push(node);
    node=node.nextElementSibling;
  }

  heading.dataset.engageGlobalLocationHeading='true';
  heading.style.display='none';
  rows.forEach(row=>{
    row.dataset.engageGlobalLocationSettings='true';
    row.style.display='none';
  });
}

function employeeDialog(){
  return [...document.querySelectorAll('[role="dialog"],body > div div')].find(n=>visible(n)&&/^Employee Settings — /.test(text(n).slice(0,80)))||null;
}
function employeeNameFromDialog(dialog){
  const all=[...dialog.querySelectorAll('div,h1,h2,h3')].map(text);
  const title=all.find(t=>t.startsWith('Employee Settings — '));
  return title?title.replace('Employee Settings — ','').trim():'';
}
async function resolveEmployeeId(name){
  const data=await request('/admin/salesmen');
  const rows=data?.salesmen||[];
  const matches=rows.filter(x=>String(x.full_name||x.name||'').trim()===name);
  if(matches.length!==1) throw new Error(matches.length?'Employee name is not unique.':'Employee not found.');
  return matches[0].id;
}
function switchRow(label,description,key,policy,onChange){
  const row=document.createElement('label');
  row.className='ft-q-check';
  row.style.cssText='display:flex;align-items:flex-start;gap:10px;padding:11px 0;cursor:pointer;border-bottom:1px solid #edf1ef;transition:opacity .15s ease;';
  const input=document.createElement('input');input.type='checkbox';input.setAttribute('role','switch');input.checked=!!policy[key];
  input.addEventListener('change',()=>onChange(key,input.checked));
  const body=document.createElement('span');body.style.cssText='display:block;min-width:0;';
  const title=document.createElement('span');title.style.cssText='display:block;font-size:13px;font-weight:750;color:#1f2c28;';title.textContent=label;
  const sub=document.createElement('span');sub.style.cssText='display:block;margin-top:3px;font-size:11.5px;line-height:1.45;color:#6f7a75;';sub.textContent=description;
  body.append(title,sub);row.append(input,body);
  return {row,input,body,title,sub};
}
async function mountEmployeeLocation(dialog){
  if(dialog.querySelector('[data-engage-employee-location]')) return;
  const workButton=[...dialog.querySelectorAll('button')].find(b=>text(b)==='Work Rules');
  if(!workButton) return;
  const dayClosing=exactTextNode('Day Closing',dialog);
  if(!dayClosing) return;

  const host=document.createElement('div');host.dataset.engageEmployeeLocation='true';host.className='ft-q-box';host.style.marginTop='14px';
  host.innerHTML='<h3 style="margin:0 0 4px">Location & Tracking</h3><p class="ft-ob-muted" style="margin-top:0">Control GPS and live tracking for this employee only.</p><div data-location-body style="font-size:12px;color:#6f7a75;padding:8px 0">Loading location policy…</div>';
  const leadBox=exactTextNode('Lead Permissions',dialog)?.closest('.ft-q-box');
  if(leadBox) leadBox.insertAdjacentElement('afterend',host); else dayClosing.closest('.ft-q-box')?.insertAdjacentElement('afterend',host);

  const body=host.querySelector('[data-location-body]');
  try{
    const name=employeeNameFromDialog(dialog);const id=await resolveEmployeeId(name);
    let policy=policyCache.get(id)||await request(`/admin/employees/${id}/location-policy`);
    policyCache.set(id,policy);
    body.innerHTML='';body.style.padding='0';
    let draft={...policy};let dirty=false;
    const status=document.createElement('div');status.style.cssText='font-size:11.5px;margin-top:8px;min-height:18px;color:#6f7a75;';
    const save=document.createElement('button');save.type='button';save.className='ft-ob-primary';save.textContent='Save Location Settings';save.style.marginTop='10px';save.disabled=false;

    let gpsControl,mandatoryControl,continuousControl;
    const setDirty=()=>{dirty=true;status.textContent='Unsaved changes';status.style.color='#9a6b18';};
    const applyDependencyState=()=>{
      const enabled=!!draft.gpsLocation;
      [mandatoryControl,continuousControl].forEach(control=>{
        if(!control) return;
        control.input.disabled=!enabled;
        control.row.style.cursor=enabled?'pointer':'not-allowed';
        control.row.style.opacity=enabled?'1':'.5';
        control.row.setAttribute('aria-disabled',enabled?'false':'true');
      });
      if(!enabled){
        draft={...draft,locationMandatoryForNewLead:false,continuousGpsTracking:false};
        if(mandatoryControl) mandatoryControl.input.checked=false;
        if(continuousControl) continuousControl.input.checked=false;
      }
    };
    const onChange=(key,value)=>{
      draft={...draft,[key]:value};
      if(key==='gpsLocation') applyDependencyState();
      setDirty();
    };

    gpsControl=switchRow('GPS Location','If off, leads can be saved with no location at all.','gpsLocation',draft,onChange);
    mandatoryControl=switchRow('Location Mandatory for New Lead','When GPS is on, location must be captured before a new lead can be saved.','locationMandatoryForNewLead',draft,onChange);
    continuousControl=switchRow('Continuous GPS Tracking','Sends live location pings only while this employee\'s day is active.','continuousGpsTracking',draft,onChange);
    body.append(gpsControl.row,mandatoryControl.row,continuousControl.row);
    applyDependencyState();

    save.addEventListener('click',async()=>{
      if(!dirty){status.textContent='No changes to save.';status.style.color='#6f7a75';return;}
      save.disabled=true;save.textContent='Saving…';status.textContent='';
      try{
        const saved=await request(`/admin/employees/${id}/location-policy`,{method:'PUT',body:JSON.stringify({...draft,version:policy.version})});
        policy=saved;draft={...saved};policyCache.set(id,saved);dirty=false;
        gpsControl.input.checked=!!draft.gpsLocation;
        mandatoryControl.input.checked=!!draft.locationMandatoryForNewLead;
        continuousControl.input.checked=!!draft.continuousGpsTracking;
        applyDependencyState();
        status.textContent='Location settings saved.';status.style.color='#12805C';
      }catch(e){status.textContent=e.message||'Could not save location settings.';status.style.color='#b42318';}
      finally{save.disabled=false;save.textContent='Save Location Settings';}
    });
    body.append(save,status);
  }catch(e){body.textContent=e.message||'Could not load location settings.';body.style.color='#b42318';}
}

function apply(){queued=false;removeGlobalLocationSettings();const dialog=employeeDialog();if(dialog) mountEmployeeLocation(dialog);}
function queue(){if(queued)return;queued=true;requestAnimationFrame(apply);}
function install(){if(observer)return;observer=new MutationObserver(queue);observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});window.addEventListener('focus',queue);setTimeout(queue,0);}
install();
