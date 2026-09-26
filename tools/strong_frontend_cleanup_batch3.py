from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
app_path=ROOT/'src'/'App.jsx'
api_path=ROOT/'src'/'api.js'
main_path=ROOT/'src'/'main.jsx'
exc_path=ROOT/'src'/'ExceptionCentre.jsx'
drawer_path=ROOT/'src'/'exceptionLeadDrawer.jsx'

app=app_path.read_text(); api=api_path.read_text(); main=main_path.read_text(); exc=exc_path.read_text(); drawer=drawer_path.read_text()

# Exception Centre is now a normal child of App, not a separately mounted React root.
if 'import ExceptionCentre from "./ExceptionCentre.jsx";' not in app:
    app=app.replace('import NotificationsPanel from "./NotificationsPanel.jsx";\n','import NotificationsPanel from "./NotificationsPanel.jsx";\nimport ExceptionCentre from "./ExceptionCentre.jsx";\n',1)
anchor='''  } else if (session.role === "admin") {\n    body = <AdminApp desktopSection={adminDesktop ? (topPage === "reports" ? "reports" : desktopSection === "reports" ? "dashboard" : desktopSection) : null} notificationLead={notificationLead} session={session} online={online} onLogout={handleLogout} page={topPage} />;\n  } else {'''
replacement='''  } else if (session.role === "admin") {\n    body = adminDesktop && desktopSection === "exceptions" && topPage !== "reports"\n      ? <ExceptionCentre onNavigate={selectDesktopSection} />\n      : <AdminApp desktopSection={adminDesktop ? (topPage === "reports" ? "reports" : desktopSection === "reports" ? "dashboard" : desktopSection) : null} notificationLead={notificationLead} session={session} online={online} onLogout={handleLogout} page={topPage} />;\n  } else {'''
if anchor not in app: raise SystemExit('App admin body anchor missing')
app=app.replace(anchor,replacement,1)
app_path.write_text(app)

# Renewal normalization becomes an API-layer invariant rather than a runtime monkeypatch.
helper='''\nconst RENEWAL_MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];\nfunction normalizeRenewalPayload(payload = {}) {\n  if (!payload || typeof payload !== "object" || !payload.renewalDate) return payload;\n  const month = Number(String(payload.renewalDate).slice(5, 7));\n  return {\n    ...payload,\n    renewalMonth: month >= 1 && month <= 12 ? RENEWAL_MONTH_NAMES[month - 1] : (payload.renewalMonth || null),\n  };\n}\n'''
if 'function normalizeRenewalPayload' not in api:
    api=api.replace('export class ApiError extends Error {',helper+'\nexport class ApiError extends Error {',1)
repls={
'adminCreateLead: (payload) => request(`/admin/leads`, { method: "POST", body: payload }),':'adminCreateLead: (payload) => request(`/admin/leads`, { method: "POST", body: normalizeRenewalPayload(payload) }),',
'adminUpdateLead: (id, payload) => request(`/admin/leads/${id}`, { method: "PATCH", body: payload }),':'adminUpdateLead: (id, payload) => request(`/admin/leads/${id}`, { method: "PATCH", body: normalizeRenewalPayload(payload) }),',
'salesmanCreateLead: (payload) => request("/salesman/leads", { method: "POST", body: payload }),':'salesmanCreateLead: (payload) => request("/salesman/leads", { method: "POST", body: normalizeRenewalPayload(payload) }),',
'salesmanUpdateLead: (id, payload) => request(`/salesman/leads/${id}`, { method: "PATCH", body: payload }),':'salesmanUpdateLead: (id, payload) => request(`/salesman/leads/${id}`, { method: "PATCH", body: normalizeRenewalPayload(payload) }),',
}
for old,new in repls.items():
    if old not in api: raise SystemExit(f'API renewal anchor missing: {old[:30]}')
    api=api.replace(old,new,1)
api_path.write_text(api)

# Turn exception lead drawer into a regular component and remove its global click bridge/root.
# Existing LeadDrawer already contains all UI/data loading we need.
drawer=drawer.replace('function LeadDrawer({ request, onClose }) {','export default function ExceptionLeadDrawer({ request, onClose }) {',1)
bridge_start=drawer.find('\nexport default function ExceptionLeadDrawerBridge()')
if bridge_start == -1: raise SystemExit('Exception lead drawer bridge anchor missing')
drawer=drawer[:bridge_start].rstrip()+'\n'
drawer_path.write_text(drawer)

# ExceptionCentre owns drawer state/actions directly.
if "import ExceptionLeadDrawer from './exceptionLeadDrawer.jsx';" not in exc:
    exc=exc.replace("import './exception-centre.css';","import './exception-centre.css';\nimport ExceptionLeadDrawer from './exceptionLeadDrawer.jsx';",1)
# remove imperative DOM sidebar/lead navigation helpers
start=exc.find('\nfunction openSidebar(label) {')
end=exc.find('\nfunction buildDetections(',start)
if start!=-1 and end!=-1: exc=exc[:start]+exc[end:]
exc=exc.replace('export default function ExceptionCentre() {','export default function ExceptionCentre({ onNavigate }) {',1)
state_anchor="  const [lastUpdated,setLastUpdated] = useState(null);\n"
if state_anchor not in exc: raise SystemExit('Exception state anchor missing')
exc=exc.replace(state_anchor,state_anchor+"  const [leadRequest,setLeadRequest] = useState(null);\n  const [toast,setToast] = useState('');\n",1)
old_snooze="  const snooze = (item,days) => mutate(item,{action:'snooze',until:new Date(Date.now()+days*DAY).toISOString()});"
new_snooze="  const snooze = async (item,days) => { await mutate(item,{action:'snooze',until:new Date(Date.now()+days*DAY).toISOString()}); setToast(`Snoozed for ${days} day${days===1?'':'s'}`); setTimeout(()=>setToast(''),2200); };"
if old_snooze not in exc: raise SystemExit('Snooze anchor missing')
exc=exc.replace(old_snooze,new_snooze,1)
old_primary="""  const primaryAction = item => {\n    const type = item.entity_type || item.entityType;\n    if (type === 'lead') return openLead(item.entity_name || item.entityName);\n    if (type === 'task') return openSidebar('Tasks');\n    if (type === 'payment') { document.querySelector('.ft-app-menu-trigger')?.click(); }\n  };"""
new_primary="""  const primaryAction = item => {\n    const type = item.entity_type || item.entityType;\n    if (type === 'lead') {\n      setLeadRequest({ name:item.entity_name || item.entityName, title:item.title, reason:item.reason, openedAt:Date.now() });\n      return;\n    }\n    if (type === 'task') { onNavigate?.('tasks'); return; }\n    if (type === 'payment') window.dispatchEvent(new CustomEvent('fieldtrail:open-collections'));\n  };"""
if old_primary not in exc: raise SystemExit('Primary action anchor missing')
exc=exc.replace(old_primary,new_primary,1)
old_button='<button title="Snooze 1 day" onClick={()=>snooze(item,1)}><PauseCircle size={15}/></button>'
new_button='<button className="exception-snooze" title="Snooze for 1 day" onClick={()=>snooze(item,1)}><PauseCircle size={15}/><span className="exception-snooze-label">Snooze</span></button>'
if old_button not in exc: raise SystemExit('Snooze button anchor missing')
exc=exc.replace(old_button,new_button,1)
# inject drawer and toast just inside main
main_tag='  return <main className="exception-centre">\n'
if main_tag not in exc: raise SystemExit('Exception main tag missing')
exc=exc.replace(main_tag,'  return <main className="exception-centre">\n    {toast&&<div className="exception-ux-toast is-visible" data-tone="success">{toast}</div>}\n    {leadRequest&&<ExceptionLeadDrawer request={leadRequest} onClose={()=>setLeadRequest(null)}/>}\n',1)
exc_path.write_text(exc)

for line in [
 'import "./exceptionCentreMount.jsx";\n',
 'import "./exceptionCentreUxFix.js";\n',
 'import "./exceptionLeadDrawer.jsx";\n',
 'import "./renewalExpiryData.js";\n',
]: main=main.replace(line,'')
main_path.write_text(main)
print('Batch 3 applied')
