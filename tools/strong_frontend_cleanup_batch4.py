from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
app_path=ROOT/'src'/'App.jsx'; main_path=ROOT/'src'/'main.jsx'
app=app_path.read_text(); main=main_path.read_text()

if 'AdminMobileLeadTrend' not in app.split('\n',30)[0:30]:
    app=app.replace('import NotificationsPanel from "./NotificationsPanel.jsx";\n','import NotificationsPanel from "./NotificationsPanel.jsx";\nimport { AdminMobileLeadTrend, AdminTeamActivitySheet } from "./AdminMobileEnhancements.jsx";\n',1)

anchor='''  const [mobileTab, setMobileTab] = useState("dashboard");\n  const [tasksVisited, setTasksVisited] = useState(false);'''
replacement='''  const [mobileTab, setMobileTab] = useState("dashboard");\n  const [showTeamActivity, setShowTeamActivity] = useState(false);\n  const [tasksVisited, setTasksVisited] = useState(false);'''
if anchor not in app: raise SystemExit('Admin mobile state anchor missing')
app=app.replace(anchor,replacement,1)

# Native mobile utility row before KPI cards.
card_anchor='''      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>\n        <StatCard variant="dashboard" label="Total Employees"'''
utility='''      {phone && (\n        <div className="engage-admin-mobile-dashboard-utility">\n          <div className="engage-admin-mobile-greeting">{new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening"}, {(getSession()?.fullName || getSession()?.full_name || getSession()?.name || "Admin").split(/\\s+/)[0]} 👋</div>\n          <div className="engage-admin-mobile-team-slot">\n            <select aria-label="Dashboard employee" value={dashboardSalesman} onChange={(e)=>setDashboardSalesman(e.target.value)}>\n              <option value="all">All Team</option>\n              {salesmen.map((s)=><option key={s.id} value={s.id}>{s.name}</option>)}\n            </select>\n          </div>\n        </div>\n      )}\n      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>\n        <StatCard variant="dashboard" label="Total Employees"'''
if card_anchor not in app: raise SystemExit('Dashboard KPI anchor missing')
app=app.replace(card_anchor,utility,1)

old='''<StatCard variant="dashboard" label="Total Employees" value={salesmen.length} sub={<span style={{color:T.verified}}>{activeSalesmen} active now</span>} icon={Contact2} color="#64748B" />'''
new='''<StatCard variant="dashboard" label="Total Employees" value={salesmen.length} sub={<span style={{color:T.verified}}>{activeSalesmen} active now</span>} icon={Contact2} color="#64748B" onClick={phone ? () => setShowTeamActivity(true) : undefined} />'''
if old not in app: raise SystemExit('Total employees card anchor missing')
app=app.replace(old,new,1)

row_end='''        <StatCard variant="dashboard" label="Renewals Due" sub="next 30 days" value={upcomingRenewals.length} icon={RefreshCw} color={T.accent} onClick={() => setStatLeadsModal({ title: "Renewals Due (Next 30 Days)", leads: upcomingRenewals })} />\n      </div>\n\n      {conversationError'''
row_new='''        <StatCard variant="dashboard" label="Renewals Due" sub="next 30 days" value={upcomingRenewals.length} icon={RefreshCw} color={T.accent} onClick={() => setStatLeadsModal({ title: "Renewals Due (Next 30 Days)", leads: upcomingRenewals })} />\n      </div>\n      {phone && <AdminMobileLeadTrend leads={dashboardLeads} />}\n\n      {conversationError'''
if row_end not in app: raise SystemExit('Dashboard row end missing')
app=app.replace(row_end,row_new,1)

# Mount the team sheet from React next to existing admin modals.
modal_anchor='''      {selectedLead && <LeadDetailDrawer'''
if modal_anchor not in app: raise SystemExit('Admin modal anchor missing')
app=app.replace(modal_anchor,'''      {showTeamActivity && <AdminTeamActivitySheet salesmen={salesmen} onClose={() => setShowTeamActivity(false)} />}\n      {selectedLead && <LeadDetailDrawer''',1)
app_path.write_text(app)

for line in ['import "./adminMobileLeadTrend.js";\n','import "./adminTeamActivity.js";\n']:
    main=main.replace(line,'')
main_path.write_text(main)
print('Batch 4 applied')
