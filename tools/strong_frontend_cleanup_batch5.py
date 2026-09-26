from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
app_path=ROOT/'src'/'App.jsx'; main_path=ROOT/'src'/'main.jsx'
app=app_path.read_text(); main=main_path.read_text()

if 'import DataHealth from "./DataHealth.jsx";' not in app:
    app=app.replace('import ExceptionCentre from "./ExceptionCentre.jsx";\n','import ExceptionCentre from "./ExceptionCentre.jsx";\nimport DataHealth from "./DataHealth.jsx";\n',1)

state='''  const [showCrmSettings, setShowCrmSettings] = useState(false);\n  const [showAddExpense, setShowAddExpense] = useState(false);'''
new_state='''  const [showCrmSettings, setShowCrmSettings] = useState(false);\n  const [showDataHealth, setShowDataHealth] = useState(false);\n  const [showAddExpense, setShowAddExpense] = useState(false);'''
if state not in app: raise SystemExit('Data Health state anchor missing')
app=app.replace(state,new_state,1)

sig='''function SettingsModal({ apiBase, onClose, onSave, onLogout, onOpenCrmSettings, onOpenOnboardingSettings, onOpenQuotationSettings, canInstall, installed, promptInstall, push }) {'''
new_sig='''function SettingsModal({ apiBase, onClose, onSave, onLogout, onOpenCrmSettings, onOpenDataHealth, onOpenOnboardingSettings, onOpenQuotationSettings, canInstall, installed, promptInstall, push }) {'''
if sig not in app: raise SystemExit('Settings signature anchor missing')
app=app.replace(sig,new_sig,1)

crm='''      {onOpenCrmSettings && (\n        <button\n          onClick={onOpenCrmSettings}\n          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 11, border: `1px solid ${T.line}`, cursor: "pointer", background: T.paperDeep, color: T.ink, fontWeight: 700, fontSize: 13.5, marginBottom: 18 }}\n        >\n          <Settings size={14} /> CRM Settings\n        </button>\n      )}\n'''
insert=crm+'''      {onOpenDataHealth && (\n        <button type="button" onClick={onOpenDataHealth} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 11, border: `1px solid ${T.line}`, cursor: "pointer", background: T.paperDeep, color: T.ink, fontWeight: 700, fontSize: 13.5, marginTop: -6, marginBottom: 18 }}>\n          <CheckCircle2 size={14} /> Data Health\n        </button>\n      )}\n'''
if crm not in app: raise SystemExit('CRM settings button anchor missing')
app=app.replace(crm,insert,1)

prop='''          onOpenCrmSettings={session?.role === "admin" ? () => { setShowSettings(false); setShowCrmSettings(true); } : undefined}\n          onOpenQuotationSettings='''
new_prop='''          onOpenCrmSettings={session?.role === "admin" ? () => { setShowSettings(false); setShowCrmSettings(true); } : undefined}\n          onOpenDataHealth={session?.role === "admin" ? () => { setShowSettings(false); setShowDataHealth(true); } : undefined}\n          onOpenQuotationSettings='''
if prop not in app: raise SystemExit('Settings prop anchor missing')
app=app.replace(prop,new_prop,1)

render='''      {showCrmSettings && <CrmSettingsModal onClose={() => setShowCrmSettings(false)} />}\n      {showAddExpense && <AddExpenseModal onClose={() => setShowAddExpense(false)} />}'''
new_render='''      {showCrmSettings && <CrmSettingsModal onClose={() => setShowCrmSettings(false)} />}\n      {showDataHealth && <DataHealth onClose={() => setShowDataHealth(false)} />}\n      {showAddExpense && <AddExpenseModal onClose={() => setShowAddExpense(false)} />}'''
if render not in app: raise SystemExit('Data Health render anchor missing')
app=app.replace(render,new_render,1)
app_path.write_text(app)
main=main.replace('import "./dataHealthEnhance.js";\n','')
main_path.write_text(main)
print('Batch 5 applied')
