import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardList, X, ChevronRight } from 'lucide-react';
import { api, getSession } from './api.js';
import './tasks.css';
const changed = () => { window.dispatchEvent(new Event('fieldtrail:tasks')); window.dispatchEvent(new Event('fieldtrail:notifications-read')); };
const time = value => new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function TasksEntry({ lead, compact = false }) {
 const [open,setOpen]=useState(false),[count,setCount]=useState(null),[error,setError]=useState('');
 const admin=getSession()?.role==='admin';
 const refresh=useCallback(()=>{ if(lead)return; api.tasks({filter:'all'}).then(r=>{setCount(r.pending);setError('')}).catch(()=>setError('Could not refresh tasks')); },[lead]);
 useEffect(()=>{let alive=true;const load=()=>{if(alive)refresh()};load();const timer=setInterval(load,60000);window.addEventListener('fieldtrail:tasks',load);return()=>{alive=false;clearInterval(timer);window.removeEventListener('fieldtrail:tasks',load)}},[refresh]);
 return <><button className={compact?'ft-task-link':'ft-task-entry'} type="button" onClick={()=>setOpen(true)} disabled={lead?.syncStatus==='queued'}>
 <span><ClipboardList size={compact?13:16}/>{compact?'+ Add task':admin?'Team Tasks':'My Tasks'}{!compact&&count!==null&&<span className="ft-task-count">{count} pending</span>}</span>{!compact&&<ChevronRight size={16}/>}</button>{error&&!compact&&<div className="ft-task-muted">{error}. Open to retry.</div>}
 {open&&<TasksModal lead={lead} startCreate={compact} onClose={()=>setOpen(false)}/>}</>;
}

export function TasksModal({lead,onClose,startCreate=false,focusId}) {
 const admin=getSession()?.role==='admin';
 const [filter,setFilter]=useState(focusId||lead||admin?'all':'today'),[page,setPage]=useState(0),[tasks,setTasks]=useState([]),[more,setMore]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 const [deleting,setDeleting]=useState(null);
 const [creating,setCreating]=useState(startCreate),[employees,setEmployees]=useState([]),[employeesReady,setEmployeesReady]=useState(!admin),[assigned,setAssigned]=useState(lead?.salesmanId||''),[title,setTitle]=useState(''),[notes,setNotes]=useState(''),[due,setDue]=useState(''),[busy,setBusy]=useState(false),[completing,setCompleting]=useState(null),[result,setResult]=useState(''),[saveError,setSaveError]=useState(''),[success,setSuccess]=useState(''),[selectedId,setSelectedId]=useState(focusId||'');
 const dialog=useRef(null),close=useRef(onClose),busyRef=useRef(busy);close.current=onClose;busyRef.current=busy;
 useEffect(()=>{const prev=document.activeElement,overflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.current?.querySelector('button')?.focus();const key=e=>{if(e.key==='Escape'){e.stopPropagation();if(!busyRef.current)close.current()}if(e.key==='Tab'){const items=[...dialog.current.querySelectorAll('button:not(:disabled),input,select,textarea,summary')].filter(el=>!el.closest('[hidden]'));const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}};document.addEventListener('keydown',key,true);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key,true);prev?.focus()}},[]);
 useEffect(()=>{let cancelled=false;setLoading(true);setError('');api.tasks({filter,offset:page*50,...(lead?{leadId:lead.id}:{}),...(selectedId?{taskId:selectedId}:{})}).then(r=>{if(!cancelled){setTasks(r.tasks);setMore(r.hasMore)}}).catch(e=>{if(!cancelled)setError(e.message)}).finally(()=>{if(!cancelled)setLoading(false)});return()=>{cancelled=true}},[filter,page,lead?.id,revision,selectedId]);
 useEffect(()=>{if(!admin||!creating)return;let cancelled=false;setEmployeesReady(false);api.adminSalesmen().then(r=>{if(cancelled)return;setEmployees((r.salesmen||[]).filter(s=>s.is_active));setEmployeesReady(true)}).catch(e=>{if(!cancelled)setSaveError(e.message)});return()=>{cancelled=true}},[admin,creating]);
 const reload=()=>{setRevision(v=>v+1);changed()};
 const create=async e=>{e.preventDefault();if(busy)return;setBusy(true);setSaveError('');setSuccess('');try{await api.createTask({title,notes,dueAt:new Date(due+'+05:30').toISOString(),...(admin?{assignedTo:assigned}:{}),...(lead?{leadId:lead.id}:{})});setCreating(false);setTitle('');setNotes('');setDue('');setSelectedId('');setFilter('all');setPage(0);setSuccess('Task saved.');reload()}catch(e){setSaveError(e.message)}finally{setBusy(false)}};
 const complete=async e=>{e.preventDefault();if(busy)return;setBusy(true);setSaveError('');try{await api.completeTask(completing.id,result);setCompleting(null);setResult('');setSuccess('Task completed.');reload()}catch(e){setSaveError(e.message)}finally{setBusy(false)}};
 const remove=async task=>{if(busy)return;setBusy(true);setSaveError('');try{await api.deleteTask(task.id);setDeleting(null);if(completing?.id===task.id)setCompleting(null);setSelectedId('');setPage(0);setSuccess('Task deleted.');reload()}catch(e){setSaveError(e.message)}finally{setBusy(false)}};
 return createPortal(<div className="ft-tasks-backdrop" onClick={e=>{e.stopPropagation();if(!busy)onClose()}}><section className="ft-tasks-dialog" role="dialog" aria-modal="true" aria-labelledby="ft-tasks-title" ref={dialog} onClick={e=>e.stopPropagation()}>
 <header><h2 id="ft-tasks-title">{lead?'Lead tasks':admin?'Team Tasks':'My Tasks'}</h2><button type="button" aria-label="Close tasks" onClick={onClose} disabled={busy}><X size={19}/></button></header>
 {lead&&<p className="ft-task-muted">{lead.business}</p>}
 {!creating&&!completing&&<button className="ft-task-primary" onClick={()=>{setSaveError('');setCreating(true)}}>+ {admin?'Assign task':'Add task'}</button>}
 {creating&&<form className="ft-task-form" onSubmit={create}><label>Task<input required maxLength={180} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Visit owner with quotation"/></label>
 {admin&&<label>Assign to<select required value={assigned} disabled={!!lead||!employeesReady} onChange={e=>setAssigned(e.target.value)}><option value="">Select employee</option>{employees.map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select>{lead&&<span className="ft-task-muted">Assigned to this lead’s owner</span>}</label>}
 <label>Due date and time (IST)<input type="datetime-local" required value={due} onChange={e=>setDue(e.target.value)}/></label><label>Notes (optional)<textarea maxLength={2000} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
 {!lead&&<p className="ft-task-muted">To link a task to a lead, use “+ Add task” inside that lead.</p>}
 <div className="ft-task-actions"><button className="ft-task-primary" disabled={busy||(admin&&(!employeesReady||!assigned))}>{busy?'Saving…':'Save task'}</button><button type="button" disabled={busy} onClick={()=>{setCreating(false);setSaveError('')}}>Cancel</button></div></form>}
 {completing&&<form className="ft-task-form" onSubmit={complete}><strong>{completing.title}</strong><label>Completion note (optional)<textarea value={result} maxLength={2000} onChange={e=>setResult(e.target.value)} placeholder="What was the outcome?"/></label><div className="ft-task-actions"><button className="ft-task-primary" disabled={busy}>{busy?'Saving…':'Confirm completion'}</button><button type="button" disabled={busy} onClick={()=>{setCompleting(null);setSaveError('')}}>Cancel</button></div></form>}
 {saveError&&<p role="alert" className="ft-task-error">{saveError}</p>}{success&&<p role="status" className="ft-task-muted">{success}</p>}
 <div className="ft-task-tabs">{['all','today','upcoming','overdue','completed'].map(f=><button key={f} aria-pressed={filter===f&&!selectedId} onClick={()=>{setSelectedId('');setFilter(f);setPage(0)}}>{f[0].toUpperCase()+f.slice(1)}</button>)}</div>
 <p className="ft-task-muted">Dates in IST · Overdue includes tasks past their due time today.</p>
 {loading?<p role="status">Loading tasks…</p>:error?<div role="alert"><p>{error}</p><button onClick={reload}>Retry</button></div>:<>{!tasks.length&&<p className="ft-task-muted">No tasks in this view.</p>}{tasks.map(t=><article key={t.id} className="ft-task-row"><div className="ft-task-row-top"><strong>{t.title}</strong><span className={'ft-task-status '+(t.status==='completed'?'done':new Date(t.due_at)<new Date()?'late':'')}>{t.status==='completed'?'Completed':new Date(t.due_at)<new Date()?'Overdue':'Pending'}</span></div>{t.business_name&&<div className="ft-task-muted">{t.business_name}</div>}<div className="ft-task-muted">{admin?t.assignee_name+' · ':''}{time(t.due_at)} IST</div>{t.notes&&<p>{t.notes}</p>}{t.status==='completed'?<p className="ft-task-muted">Completed {time(t.completed_at)} IST{t.completion_note?' · '+t.completion_note:''}</p>:<button disabled={busy} onClick={()=>{setCompleting(t);setResult('');setSaveError('');setCreating(false);dialog.current?.scrollTo?.({top:0})}}>Mark complete</button>}
 {(admin||(t.created_by===getSession()?.id&&t.assigned_to===getSession()?.id))&&<details className="ft-task-menu"><summary aria-label={`Task options for ${t.title}`}>•••</summary><button type="button" disabled={busy} className="ft-task-delete" onClick={e=>{e.currentTarget.closest('details').open=false;setDeleting(t.id);setSaveError('')}}>Delete task</button></details>}
 {deleting===t.id&&<div className="ft-task-delete-confirm" role="group" aria-label={`Confirm deletion of ${t.title}`}><p>Delete “{t.title}”? This permanently removes the task and its alerts.</p><div className="ft-task-actions"><button className="ft-task-delete" disabled={busy} onClick={()=>remove(t)}>{busy?'Deleting…':'Confirm delete'}</button><button disabled={busy} onClick={()=>setDeleting(null)}>Cancel</button></div></div>}
 </article>)}<div className="ft-task-actions">{page>0&&<button onClick={()=>setPage(p=>p-1)}>Previous</button>}{more&&<button onClick={()=>setPage(p=>p+1)}>Next</button>}</div></>}
 </section></div>,document.body);
}

export function TaskNotifications(){
 const [items,setItems]=useState([]),[error,setError]=useState(''),[focus,setFocus]=useState(null),[version,setVersion]=useState(0);
 useEffect(()=>{let cancelled=false;api.taskNotifications().then(r=>{if(!cancelled){setItems(r.notifications);setError('')}}).catch(e=>{if(!cancelled)setError(e.message)});return()=>{cancelled=true}},[version]);
 const open=async item=>{setFocus(item.task_id);try{await api.readTaskNotifications([item.id]);setItems(v=>v.filter(n=>n.id!==item.id));changed()}catch(e){setError('Task opened, but could not mark the alert read.')}};
 return <div className="ft-task-notifications">{error&&<div role="alert">{error} <button onClick={()=>setVersion(v=>v+1)}>Retry</button></div>}{items.length>0&&<><h3>Task alerts</h3>{items.map(n=><button key={n.id} className="ft-task-alert" onClick={()=>open(n)}><strong>{n.kind==='assigned'?'New task: ':'Task reminder: '}{n.title}</strong><span>{time(n.due_at)} IST · View task →</span></button>)}</>}{focus&&<TasksModal focusId={focus} onClose={()=>{setFocus(null);setVersion(v=>v+1)}}/>}</div>;
}
