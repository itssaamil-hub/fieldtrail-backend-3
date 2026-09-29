from pathlib import Path

path = Path('src/App.jsx')
app = path.read_text()

# Import the dedicated dashboard module.
anchor = 'import AdminEmployeesPanel from "./admin/AdminEmployeesPanel.jsx";\n'
if app.count(anchor) != 1:
    raise SystemExit(f'import anchor mismatch: {app.count(anchor)}')
app = app.replace(anchor, anchor + 'import AdminDashboardPanel from "./admin/AdminDashboardPanel.jsx";\n', 1)

# State now owned by AdminDashboardPanel.
for line in [
    '  const [adminPendingTasks, setAdminPendingTasks] = useState(null);\n',
    '  const [conversationError, setConversationError] = useState("");\n',
]:
    if app.count(line) != 1:
        raise SystemExit(f'state line mismatch: {line.strip()} -> {app.count(line)}')
    app = app.replace(line, '', 1)

state_start = '  const [dashboardSalesman, setDashboardSalesman] = useState("all");\n'
state_end = '  const [sheetsInfo, setSheetsInfo] = useState(null);\n'
si = app.index(state_start)
ei = app.index(state_end, si)
app = app[:si] + app[ei:]

derived_start = '  const dashboardLeads = dashboardSalesman === "all" ? leads : leads.filter((l) => l.salesmanId === dashboardSalesman);\n'
derived_end = '  const filteredLeads = leads.filter(\n'
di = app.index(derived_start)
de = app.index(derived_end, di)
app = app[:di] + app[de:]

# Replace only the dashboard KPI/greeting/activity block. Map + Employees stay separate.
jsx_start = '      <div hidden={!showDashboard}>\n'
jsx_end = '      <div hidden={!showDashboard && section !== "employees"}>\n'
js = app.index(jsx_start)
je = app.index(jsx_end, js)
replacement = '''      <AdminDashboardPanel
        phone={phone}
        showDashboard={showDashboard}
        salesmen={salesmen}
        leads={leads}
        conversationCount={conversationCount}
        onShowTeamActivity={() => setShowTeamActivity(true)}
        onOpenStatLeads={setStatLeadsModal}
        shared={{
          T, fmtMoney, isToday, isWithinDays, isUpcomingRenewalMonth,
          comparisonFor, dailyComparisonFor, getDashboardDisplaySettings,
        }}
      />
'''
app = app[:js] + replacement + app[je:]

path.write_text(app)
print('Admin dashboard extracted to src/admin/AdminDashboardPanel.jsx')
