import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardList, X, ChevronRight, Columns3, List, SlidersHorizontal, Search } from 'lucide-react';
import { api, getSession } from './api.js';
import './tasks.css';
const changed = () => { window.dispatchEvent(new Event('fieldtrail:tasks')); window.dispatchEvent(new Event('fieldtrail:notifications-read')); };
const time = value => new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function TasksEntry({ lead, compact = false, onPendingChange }) {
 const [open,setOpen]=useState(false),[count,setCount]=useState(null),[error,setError]=useState('');
 const admin=getSession()?.role==='admin';
 const refresh=useCallback(()=>{ if(lead)return; api.tasks({filter:'all'}).then(r=>{setCount(r.pending);onPendingChange?.(r.pending);setError('')}).catch(()=>{onPendingChange?.(null);setError('Could not refresh tasks')}); },[lead,onPendingChange]);
 useEffect(()=>{let alive=true;const load=()=>{if(alive)refresh()};load();const timer=setInterval(load,60000);window.addEventListener('fieldtrail:tasks',load);return()=>{alive=false;clearInterval(timer);window.removeEventListener('fieldtrail:tasks',load)}},[refresh]);
 return <><button className={compact?'ft-task-link':'ft-task-entry'} type="button" onClick={()=>setOpen(true)} disabled={lead?.syncStatus==='queued'}>
 <span><ClipboardList size={compact?13:16}/>{compact?'+ Add task':admin?'Team Tasks':'My Tasks'}{!compact&&count!==null&&<span className="ft-task-count">{count} pending</span>}</span>{!compact&&<ChevronRight size={16}/>}</button>{error&&!compact&&<div className="ft-task-muted">{error}. Open to retry.</div>}
 {open&&<TasksModal lead={lead} startCreate={compact} onClose={()=>setOpen(false)}/>}</>;
}

const statusLabel = s => ({pending:'To do',in_progress:'In progress',completed:'Completed'}[s] || s);
const repeatLabel = s => ({none:'Does not repeat',daily:'Daily',weekly:'Weekly',monthly:'Monthly'}[s] || 'Does not repeat');
const istInput = value => {
 const d = new Date(new Date(value).getTime() + 330 * 60000);
 return Number.isFinite(d.getTime()) ? d.toISOString().slice(0,16) : '';
};
const dueISO = value => new Date(value + '+05:30').toISOString();

export function TasksModal({lead,onClose,startCreate=false,focusId,embedded=false,active=true}) {
 const session=getSession(), admin=session?.role==='admin';
 const titleId=React.useId();
 const [desktop,setDesktop]=useState(()=>typeof window.matchMedia==='function'&&window.matchMedia('(min-width: 1024px)').matches);
 const [viewChoice,setViewChoice]=useState(null),[dragId,setDragId]=useState(''),[dragOver,setDragOver]=useState('');
 const view=viewChoice||(admin&&desktop?'board':'list');
 useEffect(()=>{
  if(typeof window.matchMedia!=='function')return;
  const media=window.matchMedia('(min-width: 1024px)');
  const update=()=>{setDesktop(media.matches);setViewChoice(null)};
  media.addEventListener('change',update);return()=>media.removeEventListener('change',update);
 },[]);
 const [filter,setFilter]=useState(focusId||lead||admin?'all':'today');
 const [search,setSearch]=useState(''),[query,setQuery]=useState('');
 const [employeeFilter,setEmployeeFilter]=useState(''),[priorityFilter,setPriorityFilter]=useState(''),[progressFilter,setProgressFilter]=useState('');
 const [from,setFrom]=useState(''),[through,setThrough]=useState('');
 const [mobileFiltersOpen,setMobileFiltersOpen]=useState(false);
 const [workflow,setWorkflow]=useState(null);
 const [page,setPage]=useState(0),[tasks,setTasks]=useState([]),[more,setMore]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 const [employees,setEmployees]=useState([]),[employeesReady,setEmployeesReady]=useState(!admin),[employeeError,setEmployeeError]=useState('');
 const [creating,setCreating]=useState(startCreate),[assigned,setAssigned]=useState(lead?.salesmanId||''),[title,setTitle]=useState(''),[notes,setNotes]=useState(''),[due,setDue]=useState('');
 const [priority,setPriority]=useState('medium'),[recurrence,setRecurrence]=useState('none'),[linkedLead,setLinkedLead]=useState(lead?.id||''),[leadSearch,setLeadSearch]=useState(''),[leadOptions,setLeadOptions]=useState([]),[leadLoading,setLeadLoading]=useState(false),[leadError,setLeadError]=useState('');
 const [busy,setBusy]=useState(false),[saveError,setSaveError]=useState(''),[success,setSuccess]=useState('');
 const [selectedId,setSelectedId]=useState(focusId||''),[detail,setDetail]=useState(null),[events,setEvents]=useState([]),[detailLoading,setDetailLoading]=useState(false),[detailError,setDetailError]=useState('');
 const [action,setAction]=useState(''),[completion,setCompletion]=useState(''),[newDue,setNewDue]=useState(''),[reason,setReason]=useState(''),[editPriority,setEditPriority]=useState('medium'),[editRepeat,setEditRepeat]=useState('none');
 const dialog=useRef(null),close=useRef(onClose),busyRef=useRef(busy);close.current=onClose;busyRef.current=busy;
 useEffect(()=>{
  if(embedded)return;
  const prev=document.activeElement,overflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.current?.querySelector('button')?.focus();
  const key=e=>{if(e.key==='Escape'){e.stopPropagation();if(!busyRef.current)close.current?.()}if(e.key==='Tab'){const items=[...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')].filter(el=>!el.closest('[hidden]'));const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}};
  document.addEventListener('keydown',key,true);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key,true);prev?.focus()};
 },[embedded]);
 useEffect(()=>{const timer=setTimeout(()=>{setQuery(search);setPage(0)},250);return()=>clearTimeout(timer)},[search]);
 useEffect(()=>{
  if(!active)return;let cancelled=false;setLoading(true);setError('');
  const params={filter,offset:page*50,search:query,...(lead?{leadId:lead.id}:{}),...(admin&&employeeFilter?{assignedTo:employeeFilter}:{}),...(priorityFilter?{priority:priorityFilter}:{}),...(progressFilter?{status:progressFilter}:{}),...(from?{from}:{}),...(through?{to:through}:{})};
  api.tasks(params).then(r=>{if(!cancelled){setTasks(r.tasks);setMore(r.hasMore);setWorkflow(r.workflowVersion >= 2)}}).catch(e=>{if(!cancelled)setError(e.message)}).finally(()=>{if(!cancelled)setLoading(false)});
  return()=>{cancelled=true};
 },[filter,page,query,lead?.id,revision,active,admin,employeeFilter,priorityFilter,progressFilter,from,through]);
 useEffect(()=>{
  if(!admin||!active)return;let cancelled=false;setEmployeesReady(false);setEmployeeError('');
  api.adminSalesmen().then(r=>{if(!cancelled){setEmployees(r.salesmen||[]);setEmployeesReady(true)}}).catch(e=>{if(!cancelled)setEmployeeError(e.message)});return()=>{cancelled=true};
 },[admin,active,revision]);
 useEffect(()=>{
  if(!creating||lead||!workflow||(!assigned&&admin))return;let cancelled=false;
  setLeadLoading(true);setLeadError('');
  const timer=setTimeout(()=>api.taskLeads({...(admin?{assignedTo:assigned}:{}),search:leadSearch}).then(r=>{if(!cancelled)setLeadOptions(r.leads||[])}).catch(e=>{if(!cancelled)setLeadError(e.message)}).finally(()=>{if(!cancelled)setLeadLoading(false)}),250);
  return()=>{cancelled=true;clearTimeout(timer)};
 },[creating,lead,assigned,admin,leadSearch,workflow]);
 useEffect(()=>{
  if(!selectedId||!active)return;let cancelled=false;setDetailLoading(true);setDetailError('');
  api.taskDetail(selectedId).then(r=>{if(!cancelled){setDetail(r.task);setEvents(r.events||[]);if(r.workflowAvailable===false)setWorkflow(false);setEditPriority(r.task.priority||'medium');setEditRepeat(r.task.recurrence||'none')}}).catch(e=>{if(!cancelled){setDetail(null);setDetailError(e.message)}}).finally(()=>{if(!cancelled)setDetailLoading(false)});
  return()=>{cancelled=true};
 },[selectedId,revision,active]);
 useEffect(()=>{if(!active)return;const refresh=()=>setRevision(v=>v+1);window.addEventListener('fieldtrail:tasks',refresh);return()=>window.removeEventListener('fieldtrail:tasks',refresh)},[active]);
 const reload=()=>changed();
 const mutate=async(fn,message)=>{if(busyRef.current)return;busyRef.current=true;setBusy(true);setSaveError('');setSuccess('');try{await fn();setSuccess(message);setAction('');reload();return true}catch(e){setSaveError(e.message);return false}finally{busyRef.current=false;setBusy(false)}};
 const create=async e=>{e.preventDefault();const ok=await mutate(()=>api.createTask({title,notes,dueAt:dueISO(due),...(workflow?{priority,recurrence}:{}),...(admin?{assignedTo:assigned}:{}),...(linkedLead?{leadId:linkedLead}:{})}),'Task created.');if(ok){setCreating(false);setTitle('');setNotes('');setDue('');setLinkedLead(lead?.id||'');setLeadSearch('');setFilter('all');setPage(0)}};
 const openDetail=t=>{if(busyRef.current)return;if(selectedId===t.id)setRevision(v=>v+1);setSelectedId(t.id);setDetail(null);setAction('');setSaveError('');setCreating(false)};
 const moveTask=(task,status)=>{
  setDragId('');setDragOver('');
  if(!workflow||busyRef.current||!task||task.status==='completed'||task.status===status)return;
  if(status==='completed'){openDetail(task);setAction('complete');setCompletion('');return;}
  if(status==='pending'||status==='in_progress')mutate(()=>api.taskStatus(task.id,status),'Task progress updated.');
 };
 const closeDetail=()=>{setSelectedId('');setDetail(null);setAction('');setSaveError('')};
 const openLead=()=>{if(!detail?.lead_id)return;const id=detail.lead_id;if(!embedded)onClose?.();const hash='#lead='+id;if(window.location.hash===hash)window.dispatchEvent(new Event('hashchange'));else window.location.hash=hash;};
 const changeFilter=(setter,value)=>{setter(value);setPage(0)};
 const manageable=detail&&(admin||(detail.created_by===session?.id&&detail.assigned_to===session?.id));
 const content=<div className={embedded?'ft-tasks-embedded':'ft-tasks-backdrop'} onClick={e=>{e.stopPropagation();if(!embedded&&!busy)onClose?.()}}>
  <section className="ft-tasks-dialog ft-tasks-workspace" ref={dialog} role={embedded?undefined:'dialog'} aria-modal={embedded?undefined:true} aria-labelledby={titleId} onClick={e=>e.stopPropagation()}>
   <header><div><h2 id={titleId}>{lead?'Lead tasks':admin?'Team Tasks':'My Tasks'}</h2><div className="ft-task-muted">{lead?lead.business:'Plan the work. Track the outcome.'}</div></div><div className="ft-task-header-actions"><button className="ft-task-primary" disabled={busy} onClick={()=>{setCreating(true);closeDetail();setSaveError('')}}>+ Create Task</button>{!embedded&&<button aria-label="Close tasks" onClick={onClose} disabled={busy}><X size={18}/></button>}</div></header>
   {workflow===false&&<div className="ft-task-form" role="status"><strong>Server update pending</strong><p>Existing tasks can still be opened, completed and deleted. Progress, priority, rescheduling, repeat schedules and advanced filters need the updated backend.</p><button disabled={busy} onClick={()=>setRevision(v=>v+1)}>Check server update</button></div>}
   {success&&<p role="status" className="ft-task-success">{success}</p>}
   {saveError&&<p role="alert" className="ft-task-error">{saveError}</p>}
   {employeeError&&<p role="alert" className="ft-task-error">{employeeError} <button onClick={()=>setRevision(v=>v+1)}>Retry employees</button></p>}
   {creating&&<form className="ft-task-form" onSubmit={create}>
    <h3>Create task</h3><label>Task title<input required maxLength={180} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Visit owner with quotation"/></label>
    <div className="ft-task-form-grid">{admin&&<label>Assign to<select required value={assigned} disabled={!!lead||!employeesReady||busy} onChange={e=>{setAssigned(e.target.value);setLinkedLead('');setLeadOptions([]);setLeadSearch('')}}><option value="">Select employee</option>{employees.filter(s=>s.is_active).map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select>{lead&&<span className="ft-task-muted">Assigned to this lead’s owner</span>}</label>}
    <label>Due date and time (IST)<input type="datetime-local" required value={due} onChange={e=>setDue(e.target.value)}/></label>
    <label>Priority<select disabled={!workflow} value={priority} onChange={e=>setPriority(e.target.value)}>{['high','medium','low'].map(v=><option key={v} value={v}>{v[0].toUpperCase()+v.slice(1)}</option>)}</select></label>
    <label>Repeat<select disabled={!workflow} value={recurrence} onChange={e=>setRecurrence(e.target.value)}>{['none','daily','weekly','monthly'].map(v=><option key={v} value={v}>{repeatLabel(v)}</option>)}</select></label></div>
    {recurrence!=='none'&&<p className="ft-task-muted">Completing this task creates the next future occurrence at the same IST time. Missed dates are skipped. Monthly repeats keep the original day, or the last day of a shorter month.</p>}
    {lead?<p className="ft-task-muted">Linked restaurant: {lead.business}</p>:<div className="ft-task-form-grid"><label>Find restaurant (optional)<input value={leadSearch} onChange={e=>{setLeadSearch(e.target.value);setLinkedLead('')}} disabled={!workflow||(admin&&!assigned)} placeholder="Search assigned leads" maxLength={180}/></label><label>Linked restaurant<select disabled={!workflow||(admin&&!assigned)||leadLoading} value={linkedLead} onChange={e=>setLinkedLead(e.target.value)}><option value="">{leadLoading?'Loading…':'No linked lead'}</option>{leadOptions.map(l=><option key={l.id} value={l.id}>{l.business_name}</option>)}</select></label></div>}
    {leadError&&<p className="ft-task-error" role="alert">{leadError}</p>}
    <label>Notes (optional)<textarea maxLength={2000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Instructions for this task"/></label>
    <div className="ft-task-actions"><button className="ft-task-primary" disabled={busy||(admin&&(!employeesReady||!assigned))}>{busy?'Saving…':'Save task'}</button><button type="button" disabled={busy} onClick={()=>{setCreating(false);setSaveError('')}}>Cancel</button></div>
   </form>}
   <div className="ft-task-view-switch" role="group" aria-label="Task layout"><button type="button" aria-pressed={view==='board'} onClick={()=>setViewChoice('board')}><Columns3 size={15}/> Board</button><button type="button" aria-pressed={view==='list'} onClick={()=>setViewChoice('list')}><List size={15}/> List</button></div>
   <div className="ft-task-tabs" aria-label="Task date view">{['all','today','overdue','upcoming','completed'].map(f=><button key={f} aria-pressed={filter===f} onClick={()=>{changeFilter(setFilter,f);setProgressFilter('')}}>{f[0].toUpperCase()+f.slice(1)}</button>)}</div>
   <div className="ft-task-mobile-search-row">
    <label className="ft-task-mobile-search"><Search size={16}/><input disabled={!workflow} type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tasks..." maxLength={180}/></label>
    <button type="button" className="ft-task-mobile-filter-button" onClick={()=>setMobileFiltersOpen(true)}><SlidersHorizontal size={16}/> Filter{[employeeFilter,priorityFilter,progressFilter,from,through].filter(Boolean).length>0?` (${[employeeFilter,priorityFilter,progressFilter,from,through].filter(Boolean).length})`:''}</button>
   </div>
   <div className="ft-task-filters ft-task-desktop-filters">
    <label>Search<input disabled={!workflow} type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Task or restaurant" maxLength={180}/></label>
    {admin&&<label>Employee<select disabled={!workflow} value={employeeFilter} onChange={e=>changeFilter(setEmployeeFilter,e.target.value)}><option value="">All employees</option>{employees.map(s=><option key={s.id} value={s.id}>{s.full_name}{s.is_active?'':' (inactive)'}</option>)}</select></label>}
    <label>Priority<select disabled={!workflow} value={priorityFilter} onChange={e=>changeFilter(setPriorityFilter,e.target.value)}><option value="">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
    <label>Progress<select value={progressFilter} onChange={e=>changeFilter(setProgressFilter,e.target.value)} disabled={!workflow||filter==='completed'}><option value="">All progress</option><option value="pending">To do</option><option value="in_progress">In progress</option>{filter==='all'&&<option value="completed">Completed</option>}</select></label>
    <label>Due from · IST<input disabled={!workflow} type="date" value={from} onChange={e=>changeFilter(setFrom,e.target.value)}/></label><label>Due through · IST<input disabled={!workflow} type="date" value={through} min={from} onChange={e=>changeFilter(setThrough,e.target.value)}/></label>
   </div>
   <p className="ft-task-muted ft-task-desktop-filter-help">Dates in IST · Overdue includes tasks past their due time today.</p>
   {mobileFiltersOpen&&<div className="ft-task-mobile-filter-backdrop" onClick={()=>setMobileFiltersOpen(false)}><div className="ft-task-mobile-filter-sheet" role="dialog" aria-modal="true" aria-label="Task filters" onClick={e=>e.stopPropagation()}>
    <div className="ft-task-mobile-filter-head"><div><strong>Filters</strong><span>Refine your task list</span></div><button type="button" aria-label="Close filters" onClick={()=>setMobileFiltersOpen(false)}><X size={18}/></button></div>
    <div className="ft-task-mobile-filter-fields">
     {admin&&<label>Employee<select disabled={!workflow} value={employeeFilter} onChange={e=>changeFilter(setEmployeeFilter,e.target.value)}><option value="">All employees</option>{employees.map(s=><option key={s.id} value={s.id}>{s.full_name}{s.is_active?'':' (inactive)'}</option>)}</select></label>}
     <label>Priority<select disabled={!workflow} value={priorityFilter} onChange={e=>changeFilter(setPriorityFilter,e.target.value)}><option value="">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
     <label>Progress<select value={progressFilter} onChange={e=>changeFilter(setProgressFilter,e.target.value)} disabled={!workflow||filter==='completed'}><option value="">All progress</option><option value="pending">To do</option><option value="in_progress">In progress</option>{filter==='all'&&<option value="completed">Completed</option>}</select></label>
     <label>Due from · IST<input disabled={!workflow} type="date" value={from} onChange={e=>changeFilter(setFrom,e.target.value)}/></label>
     <label>Due through · IST<input disabled={!workflow} type="date" value={through} min={from} onChange={e=>changeFilter(setThrough,e.target.value)}/></label>
     <p className="ft-task-muted">Dates in IST · Overdue includes tasks past their due time today.</p>
    </div>
    <div className="ft-task-mobile-filter-actions"><button type="button" onClick={()=>{setEmployeeFilter('');setPriorityFilter('');setProgressFilter('');setFrom('');setThrough('');setPage(0)}}>Reset</button><button type="button" className="ft-task-primary" onClick={()=>setMobileFiltersOpen(false)}>Apply filters</button></div>
   </div></div>}
   <div className={`ft-task-layout${view==='board'?' board-layout':''}${selectedId?' has-detail':''}`}><div className="ft-task-list">
   {loading?<p role="status">Loading tasks…</p>:error?<div role="alert"><p className="ft-task-error">{error}</p><button onClick={()=>setRevision(v=>v+1)}>Retry</button></div>:<>
    {view==='list'&&!tasks.length&&<div className="ft-task-empty"><ClipboardList size={26}/><strong>No tasks in this view</strong><span>Choose another filter or create a task.</span></div>}
    {view==='board'?<>
     <p className="ft-task-board-help ft-task-muted">{workflow?'Drag a task to update progress, or open it to use the action buttons.':'Open a task to view its details.'} Counts show tasks on this page.</p>
     <div className="ft-task-board" aria-label="Task board">{['pending','in_progress','completed'].map(status=>{
      const lane=tasks.filter(t=>t.status===status);
      return <section key={status} aria-label={statusLabel(status)} className={`ft-task-lane ${status}${dragOver===status?' drag-over':''}`}
       onDragOver={e=>{const task=tasks.find(t=>t.id===dragId);if(workflow&&!busy&&task&&task.status!=='completed'&&task.status!==status){e.preventDefault();e.dataTransfer.dropEffect='move';setDragOver(status)}}}
       onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setDragOver('')}}
       onDrop={e=>{e.preventDefault();moveTask(tasks.find(t=>t.id===dragId),status)}}>
       <div className="ft-task-lane-title"><span><i/>{statusLabel(status)}</span><span aria-label={`${lane.length} tasks on this page`}>{lane.length}</span></div>
       <div className="ft-task-lane-cards">{!lane.length&&<p className="ft-task-lane-empty">No tasks in this column</p>}{lane.map(t=><button key={t.id} type="button" disabled={busy}
        className={`ft-task-board-card${selectedId===t.id?' selected':''}${dragId===t.id?' dragging':''}`} onClick={()=>openDetail(t)}
        draggable={!!workflow&&!busy&&t.status!=='completed'}
        onDragStart={e=>{if(!workflow||busy||t.status==='completed'){e.preventDefault();return;}setDragId(t.id);e.dataTransfer.setData('text/plain',t.id);e.dataTransfer.effectAllowed='move'}}
        onDragEnd={()=>{setDragId('');setDragOver('')}}>
        <strong>{t.title}</strong><span className="ft-task-board-business">{t.business_name||'General task'}</span>
        <span className="ft-task-card-meta"><span>{t.assignee_name||'—'}</span><span className={`ft-task-priority ${t.priority||'medium'}`}>{t.priority||'medium'}</span></span>
        <span className="ft-task-card-footer"><span>{time(t.due_at)}</span>{t.status!=='completed'&&new Date(t.due_at)<new Date()&&<small>Overdue</small>}</span>
       </button>)}</div>
      </section>;
     })}</div>
    </>:tasks.map(t=><button key={t.id} type="button" className={`ft-task-list-row${selectedId===t.id?' selected':''}`} onClick={()=>openDetail(t)}>
     <span className="ft-task-row-main"><strong>{t.title}</strong><span className="ft-task-muted">{t.business_name||'General task'}{admin?' · '+t.assignee_name:''}</span></span>
     <span className={`ft-task-priority ${t.priority||'medium'}`}>{t.priority||'medium'}</span>
     <span className={'ft-task-status '+(t.status==='completed'?'done':t.status==='in_progress'?'progress':'')}>{statusLabel(t.status)}</span>
     <span className={`ft-task-due ${t.status!=='completed'&&new Date(t.due_at)<new Date()?'late':''}`}>{time(t.due_at)}{t.status!=='completed'&&new Date(t.due_at)<new Date()&&<small>Overdue</small>}{t.recurrence&&t.recurrence!=='none'&&<small>↻ {repeatLabel(t.recurrence)}</small>}</span><ChevronRight size={15}/>
    </button>)}
    <div className="ft-task-actions">{page>0&&<button onClick={()=>setPage(p=>p-1)}>Previous</button>}{(page>0||more)&&<span className="ft-task-muted">Page {page+1}</span>}{more&&<button onClick={()=>setPage(p=>p+1)}>Next</button>}</div>
   </>}
   </div>
   {selectedId&&<aside className="ft-task-detail" aria-label="Task details">
    <div className="ft-task-detail-head"><strong>Task details</strong><button aria-label="Close task details" disabled={busy} onClick={closeDetail}><X size={16}/></button></div>
    {detailLoading?<p role="status">Loading details…</p>:detailError?<div role="alert"><p className="ft-task-error">{detailError}</p><button onClick={()=>setRevision(v=>v+1)}>Retry</button></div>:detail&&<>
     <h3>{detail.title}</h3><div className="ft-task-detail-badges"><span className={'ft-task-status '+(detail.status==='completed'?'done':'')}>{statusLabel(detail.status)}</span><span className={`ft-task-priority ${detail.priority||'medium'}`}>{detail.priority||'medium'}</span></div>
     {detail.lead_id&&<button className="ft-task-lead-open" onClick={openLead}>{detail.business_name||'Open restaurant'} ↗</button>}
     <dl><dt>Assigned to</dt><dd>{detail.assignee_name}</dd><dt>Due · IST</dt><dd>{time(detail.due_at)}</dd><dt>Repeat</dt><dd>{repeatLabel(detail.recurrence)}</dd></dl>
     {detail.notes&&<div className="ft-task-detail-note"><strong>Instructions</strong><p>{detail.notes}</p></div>}
     {detail.status==='completed'?<div className="ft-task-completed"><strong>Completed {time(detail.completed_at)} IST</strong><p>{detail.completion_note||'No completion note added.'}</p></div>:<div className="ft-task-actions">
      <button disabled={busy||!workflow} onClick={()=>mutate(()=>api.taskStatus(detail.id,detail.status==='in_progress'?'pending':'in_progress'),'Task progress updated.')}>{detail.status==='in_progress'?'Move to To do':'Start task'}</button>
      <button className="ft-task-primary" disabled={busy} onClick={()=>{setAction('complete');setCompletion('');setSaveError('')}}>Mark complete</button>
      <button disabled={busy||!workflow} onClick={()=>{setAction('reschedule');setNewDue(istInput(detail.due_at));setReason('');setSaveError('')}}>Reschedule</button>
      {manageable&&<button disabled={busy||!workflow} onClick={()=>{setAction('options');setSaveError('')}}>Task settings</button>}
     </div>}
     {action==='complete'&&detail.status!=='completed'&&<form className="ft-task-form" onSubmit={e=>{e.preventDefault();mutate(()=>api.completeTask(detail.id,completion),'Task completed.')}}><label>Completion note (optional)<textarea maxLength={2000} value={completion} onChange={e=>setCompletion(e.target.value)} placeholder="What was done and what was the outcome?"/></label>{detail.recurrence&&detail.recurrence!=='none'&&<p className="ft-task-muted">The next occurrence will be created automatically.</p>}<div className="ft-task-actions"><button className="ft-task-primary" disabled={busy}>Confirm completion</button><button type="button" disabled={busy} onClick={()=>setAction('')}>Cancel</button></div></form>}
     {action==='reschedule'&&<form className="ft-task-form" onSubmit={e=>{e.preventDefault();mutate(()=>api.rescheduleTask(detail.id,{dueAt:dueISO(newDue),reason}),'Task rescheduled.')}}><label>New due date and time (IST)<input required type="datetime-local" value={newDue} onChange={e=>setNewDue(e.target.value)}/></label><label>Reason (required)<textarea required maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Why is the deadline changing?"/></label><div className="ft-task-actions"><button className="ft-task-primary" disabled={busy}>Save reschedule</button><button type="button" disabled={busy} onClick={()=>setAction('')}>Cancel</button></div></form>}
     {action==='options'&&<form className="ft-task-form" onSubmit={e=>{e.preventDefault();mutate(()=>api.taskOptions(detail.id,{priority:editPriority,recurrence:editRepeat}),'Task settings saved.')}}><label>Priority<select value={editPriority} onChange={e=>setEditPriority(e.target.value)}>{['high','medium','low'].map(v=><option key={v} value={v}>{v}</option>)}</select></label><label>Repeat<select value={editRepeat} onChange={e=>setEditRepeat(e.target.value)}>{['none','daily','weekly','monthly'].map(v=><option key={v} value={v}>{repeatLabel(v)}</option>)}</select></label><p className="ft-task-muted">Choose “Does not repeat” to stop future occurrences.</p><div className="ft-task-actions"><button className="ft-task-primary" disabled={busy}>Save settings</button><button type="button" disabled={busy} onClick={()=>setAction('')}>Cancel</button></div></form>}
     <h4>Activity</h4>{!events.length&&<p className="ft-task-muted">{workflow===false?'Activity history will be available after the server update.':'No changes recorded yet.'}</p>}<div className="ft-task-history">{events.map(ev=><div key={ev.id}><strong>{ev.actor_name||'Former employee'} · {ev.action.replaceAll('_',' ')}</strong><span>{ev.action==='rescheduled'?`${time(ev.old_value)} → ${time(ev.new_value)} IST`:`${statusLabel(ev.old_value)||'—'} → ${statusLabel(ev.new_value)||'—'}`}</span>{ev.reason&&<p>{ev.reason}</p>}<small>{time(ev.created_at)} IST</small></div>)}</div>
     {manageable&&<div className="ft-task-delete-area">{action==='delete'?<div className="ft-task-delete-confirm"><p>Delete “{detail.title}”? The task and its alerts will be removed. Deleting an unfinished recurring task stops its future occurrences. Deleting a completed task does not remove an already-created next occurrence.</p><div className="ft-task-actions"><button className="ft-task-delete" disabled={busy} onClick={async()=>{const ok=await mutate(()=>api.deleteTask(detail.id),'Task deleted.');if(ok){closeDetail();setPage(0)}}}>Confirm delete</button><button disabled={busy} onClick={()=>setAction('')}>Cancel</button></div></div>:<button className="ft-task-delete" disabled={busy} onClick={()=>setAction('delete')}>Delete task</button>}</div>}
    </>}
   </aside>}
   </div>
  </section>
 </div>;
 return embedded?content:createPortal(content,document.body);
}

export function TaskNotifications(){
 const [items,setItems]=useState([]),[error,setError]=useState(''),[focus,setFocus]=useState(null),[version,setVersion]=useState(0);
 useEffect(()=>{let cancelled=false;api.taskNotifications().then(r=>{if(!cancelled){setItems(r.notifications);setError('')}}).catch(e=>{if(!cancelled)setError(e.message)});return()=>{cancelled=true}},[version]);
 const open=async item=>{setFocus(item.task_id);try{await api.readTaskNotifications([item.id]);setItems(v=>v.filter(n=>n.id!==item.id));changed()}catch(e){setError('Task opened, but could not mark the alert read.')}};
 return <div className="ft-task-notifications">{error&&<div role="alert">{error} <button onClick={()=>setVersion(v=>v+1)}>Retry</button></div>}{items.length>0&&<><h3>Task alerts</h3>{items.map(n=><button key={n.id} className="ft-task-alert" onClick={()=>open(n)}><strong>{n.kind==='assigned'?'New task: ':'Task reminder: '}{n.title}</strong><span>{time(n.due_at)} IST · View task →</span></button>)}</>}{focus&&<TasksModal focusId={focus} onClose={()=>{setFocus(null);setVersion(v=>v+1)}}/>}</div>;
}

