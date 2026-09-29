from pathlib import Path

app_path = Path('src/App.jsx')
app = app_path.read_text()

start_marker = '      <div hidden={!showLeads}>\n'
end_marker = '      {expensesVisited &&'
start = app.index(start_marker)
end = app.index(end_marker, start)
block = app[start:end].rstrip()

# The feature module receives selection/add callbacks instead of reaching into AdminView state.
block = block.replace('setSelectedLead', 'onSelectLead')
block = block.replace('{onAddLead && (', '{onAddClick && (')
block = block.replace('onClick={() => setShowAdminAddLead(true)}', 'onClick={onAddClick}')

header = '''import React, { useState } from "react";\nimport { LayoutGrid, List, Plus, Search, X } from "lucide-react";\nimport DesktopContacts from "../DesktopContacts.jsx";\nimport MobileContacts from "../MobileContacts.jsx";\nimport DesktopDealsBoard from "../DesktopDealsBoard";\nimport { api, buildExportUrl } from "../api.js";\n\n'''

signature = '''export default function AdminLeadsPanel({\n  showLeads, desktopDeals, desktopContacts, sectionNavigation, section, desktopSection, phone,\n  salesmen, filteredLeads, pagedLeads, leadsViewMode, setLeadsViewMode,\n  filterSalesman, setFilterSalesman, filterStatus, setFilterStatus, filterDate, setFilterDate,\n  searchQuery, setSearchQuery, LEADS_PER_PAGE, currentPage, setLeadsPage, totalPages,\n  onStatusChange, onSelectLead, onAddClick, shared,\n}) {\n  const {\n    T, fmtMoney, Select, STATUSES, STATUS_LABEL, DownloadMenu, VerificationStamp,\n    NoLocationBadge, LeadsBoardView, leadAvatarStyle, leadInitials, fmtTime,\n  } = shared;\n  const [sheetsInfo, setSheetsInfo] = useState(null);\n  const [sheetsError, setSheetsError] = useState(\"\");\n\n  return (\n'''
footer = '''\n  );\n}\n'''

out = Path('src/admin/AdminLeadsPanel.jsx')
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(header + signature + block + footer)

# Replace old block with the feature component.
replacement = '''      <AdminLeadsPanel\n        showLeads={showLeads}\n        desktopDeals={desktopDeals}\n        desktopContacts={desktopContacts}\n        sectionNavigation={sectionNavigation}\n        section={section}\n        desktopSection={desktopSection}\n        phone={phone}\n        salesmen={salesmen}\n        filteredLeads={filteredLeads}\n        pagedLeads={pagedLeads}\n        leadsViewMode={leadsViewMode}\n        setLeadsViewMode={setLeadsViewMode}\n        filterSalesman={filterSalesman}\n        setFilterSalesman={setFilterSalesman}\n        filterStatus={filterStatus}\n        setFilterStatus={setFilterStatus}\n        filterDate={filterDate}\n        setFilterDate={setFilterDate}\n        searchQuery={searchQuery}\n        setSearchQuery={setSearchQuery}\n        LEADS_PER_PAGE={LEADS_PER_PAGE}\n        currentPage={currentPage}\n        setLeadsPage={setLeadsPage}\n        totalPages={totalPages}\n        onStatusChange={onStatusChange}\n        onSelectLead={setSelectedLead}\n        onAddClick={onAddLead ? () => setShowAdminAddLead(true) : null}\n        shared={{\n          T, fmtMoney, Select, STATUSES, STATUS_LABEL, DownloadMenu, VerificationStamp,\n          NoLocationBadge, LeadsBoardView, leadAvatarStyle, leadInitials, fmtTime,\n        }}\n      />\n'''
app = app[:start] + replacement + app[end:]

# Sheets export state is now local to the leads module.
for line in [
    '  const [sheetsInfo, setSheetsInfo] = useState(null);\n',
    '  const [sheetsError, setSheetsError] = useState(\"\");\n',
]:
    if app.count(line) != 1:
        raise SystemExit(f'sheets state mismatch: {line.strip()} -> {app.count(line)}')
    app = app.replace(line, '', 1)

anchor = 'import AdminDashboardPanel from "./admin/AdminDashboardPanel.jsx";\n'
if app.count(anchor) != 1:
    raise SystemExit(f'import anchor mismatch: {app.count(anchor)}')
app = app.replace(anchor, anchor + 'import AdminLeadsPanel from "./admin/AdminLeadsPanel.jsx";\n', 1)

app_path.write_text(app)
print('Admin leads UI extracted to src/admin/AdminLeadsPanel.jsx')
