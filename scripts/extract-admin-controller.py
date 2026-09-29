from pathlib import Path

path = Path('src/App.jsx')
app = path.read_text()

start = app.index('function AdminApp({ desktopSection, session, online, page, notificationLead }) {')
end = app.index('\nfunction AdminView(', start)

replacement = '''function AdminApp({ desktopSection, session, online, page, notificationLead }) {
  const {
    conversationCount,
    salesmen,
    leads,
    loading,
    loadError,
    wsConnected,
    onStatusChange,
    onUpdateLead,
    onDeleteLead,
    onAddLead,
    onAddSalesman,
    onEditSalesman,
    onDeleteSalesman,
    onToggleSalesmanActive,
  } = useAdminData({ online, session });

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 60, color: T.inkSoft, fontSize: 13 }}>
        <Loader2 size={16} className="spin" /> Loading dashboard…
      </div>
    );
  }

  return (
    <AdminView
      desktopSection={desktopSection}
      conversationCount={conversationCount}
      salesmen={salesmen}
      leads={leads}
      onStatusChange={onStatusChange}
      onUpdateLead={onUpdateLead}
      onDeleteLead={onDeleteLead}
      onAddLead={onAddLead}
      onAddSalesman={onAddSalesman}
      onEditSalesman={onEditSalesman}
      onDeleteSalesman={onDeleteSalesman}
      onToggleSalesmanActive={onToggleSalesmanActive}
      loadError={loadError}
      wsConnected={wsConnected}
      online={online}
      page={page}
      notificationLead={notificationLead}
    />
  );
}
'''

app = app[:start] + replacement + app[end:]
anchor = 'import AdminReportsPage from "./admin/AdminReportsPage.jsx";\n'
if app.count(anchor) != 1:
    raise SystemExit(f'import anchor mismatch: {app.count(anchor)}')
app = app.replace(anchor, anchor + 'import useAdminData from "./admin/useAdminData.js";\n', 1)
path.write_text(app)
print('Admin controller moved to src/admin/useAdminData.js')
