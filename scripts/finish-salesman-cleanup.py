from pathlib import Path

app_path = Path('src/App.jsx')
app = app_path.read_text()

anchor = 'import useSalesmanTasks from "./useSalesmanTasks.js";\n'
if app.count(anchor) != 1:
    raise SystemExit(f'import anchor expected once, found {app.count(anchor)}')
app = app.replace(anchor, anchor + 'import useSalesmanSettings from "./useSalesmanSettings.js";\n', 1)

state_block = '''  const [continuousTracking, setContinuousTracking] = useState(true); // safe default until settings load
  const [allowLeadWithoutStartDay, setAllowLeadWithoutStartDay] = useState(false);
  const [attendanceLocationPolicy, setAttendanceLocationPolicy] = useState({ start: true, end: true });
  const [dailyTarget, setDailyTarget] = useState(8); // overwritten by the salesman's actual profile below
  const [monthlyTarget, setMonthlyTarget] = useState(200);
'''
if app.count(state_block) != 1:
    raise SystemExit(f'settings state block expected once, found {app.count(state_block)}')
app = app.replace(state_block, '', 1)

profile_effect = '''  useEffect(() => {
    api.salesmanGetProfile()
      .then((res) => {
        setDailyTarget(res.profile?.daily_target || 8);
        setMonthlyTarget(res.profile?.monthly_target || 200);
      })
      .catch(() => { /* keep defaults on failure */ });
  }, []);

'''
if app.count(profile_effect) != 1:
    raise SystemExit(f'profile effect expected once, found {app.count(profile_effect)}')
app = app.replace(profile_effect, '', 1)

settings_effect = '''  useEffect(() => {
    api.salesmanGetSettings()
      .then((res) => {
        setContinuousTracking(res.locationSettings?.continuousGpsTracking ?? true);
        setAttendanceLocationPolicy({
          start: res.locationSettings?.requireLocationToStartDay !== false,
          end: res.locationSettings?.requireLocationToEndDay !== false,
        });
        setAllowLeadWithoutStartDay(!!res.employeePermissions?.allowLeadWithoutStartDay);
        setEmployeeRepliesEnabled(res.messageSettings?.employeeRepliesEnabled !== false);
      })
      .catch(() => {
        // Fail closed: if settings cannot load, Start Day remains required.
        setAllowLeadWithoutStartDay(false);
      });
  }, []);


'''
if app.count(settings_effect) != 1:
    raise SystemExit(f'settings effect expected once, found {app.count(settings_effect)}')
app = app.replace(settings_effect, '', 1)

messages_block = '''  const {
    messages,
    employeeRepliesEnabled,
    setEmployeeRepliesEnabled,
    markMessageRead,
    deleteMessage,
    replyToMessage,
  } = useSalesmanMessages();

'''
settings_hook = messages_block + '''  const {
    continuousTracking,
    allowLeadWithoutStartDay,
    attendanceLocationPolicy,
    dailyTarget,
    monthlyTarget,
  } = useSalesmanSettings({ setEmployeeRepliesEnabled });

'''
if app.count(messages_block) != 1:
    raise SystemExit(f'messages block expected once, found {app.count(messages_block)}')
app = app.replace(messages_block, settings_hook, 1)
app_path.write_text(app)

tasks_path = Path('src/Tasks.jsx')
tasks = tasks_path.read_text()
start = tasks.index('export function TasksEntry(')
end = tasks.index('\nconst statusLabel', start)
new_entry = '''export function TasksEntry({ lead, compact = false, onPendingChange }) {
 const [open,setOpen]=useState(false),[count,setCount]=useState(null),[error,setError]=useState('');
 const admin=getSession()?.role==='admin';
 const flight=useRef(null),mounted=useRef(true);
 const refresh=useCallback(()=>{
  if(lead)return Promise.resolve();
  if(flight.current)return flight.current;
  const request=api.tasks({filter:'all'}).then(r=>{if(mounted.current){setCount(r.pending);onPendingChange?.(r.pending);setError('')}}).catch(()=>{if(mounted.current){onPendingChange?.(null);setError('Could not refresh tasks')}}).finally(()=>{if(flight.current===request)flight.current=null});
  flight.current=request;
  return request;
 },[lead,onPendingChange]);
 useEffect(()=>{
  mounted.current=true;
  if(lead)return()=>{mounted.current=false};
  let stopped=false,timer=null;
  const load=()=>{if(!stopped&&document.visibilityState==='visible')refresh()};
  const schedule=()=>{if(stopped)return;timer=window.setTimeout(async()=>{load();schedule()},60000+Math.floor(Math.random()*15000))};
  const resume=()=>{if(document.visibilityState==='visible')load()};
  load();schedule();
  window.addEventListener('fieldtrail:tasks',load);
  document.addEventListener('visibilitychange',resume);
  return()=>{stopped=true;mounted.current=false;if(timer)window.clearTimeout(timer);window.removeEventListener('fieldtrail:tasks',load);document.removeEventListener('visibilitychange',resume)};
 },[lead,refresh]);
 return <><button className={compact?'ft-task-link':'ft-task-entry'} type="button" onClick={()=>setOpen(true)} disabled={lead?.syncStatus==='queued'}>
 <span><ClipboardList size={compact?13:16}/>{compact?'+ Add task':admin?'Team Tasks':'My Tasks'}{!compact&&count!==null&&<span className="ft-task-count">{count} pending</span>}</span>{!compact&&<ChevronRight size={16}/>}</button>{error&&!compact&&<div className="ft-task-muted">{error}. Open to retry.</div>}
 {open&&<TasksModal lead={lead} startCreate={compact} onClose={()=>setOpen(false)}/>}</>;
}
'''
tasks = tasks[:start] + new_entry + tasks[end:]
tasks_path.write_text(tasks)
print('salesman settings extracted and task polling hardened')
