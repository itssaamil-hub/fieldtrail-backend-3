from pathlib import Path

app_path = Path('src/App.jsx')
app = app_path.read_text()

start = app.index('function MonthlyProgressBar(')
end = app.index('\n// Draws a salesman\'s GPS trail', start)
block = app[start:end].rstrip()

block = block.replace(
    'function MonthlyProgressBar({ salesmanId, target, leads }) {',
    'function MonthlyProgressBar({ T, salesmanId, target, leads }) {',
    1,
)
block = block.replace(
    'function SalesmenPanel({ salesmen, leads, onAddClick, onSettingsClick, onBriefClick, onDeleteClick, onViewRoute, onMessageClick, onOpenSalesmanLeads }) {',
    'export default function AdminEmployeesPanel({ salesmen, leads, onAddClick, onSettingsClick, onBriefClick, onDeleteClick, onViewRoute, onMessageClick, onOpenSalesmanLeads, shared }) {\n  const { T, inputStyle } = shared;',
    1,
)
block = block.replace('<MonthlyProgressBar salesmanId=', '<MonthlyProgressBar T={T} salesmanId=')

header = '''import React, { useEffect, useState } from "react";\nimport { Battery, Gauge, Clock, Plus, MessageSquare, Sparkles, Search, Settings, Route } from "lucide-react";\nimport { getApiBase, getSession } from "../api.js";\n\nconst fmtTime = (d) => (d ? d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—");\nconst isThisMonth = (d) => {\n  const now = new Date();\n  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();\n};\n\n'''

out = Path('src/admin/AdminEmployeesPanel.jsx')
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(header + block + '\n')

# Remove old implementations before changing imports so offsets cannot drift.
app = app[:start] + app[end:]

import_anchor = 'import AdminAddLeadModalV2 from "./AdminAddLeadModal.jsx";\n'
if app.count(import_anchor) != 1:
    raise SystemExit(f'import anchor mismatch: {app.count(import_anchor)}')
app = app.replace(import_anchor, import_anchor + 'import AdminEmployeesPanel from "./admin/AdminEmployeesPanel.jsx";\n', 1)

if app.count('<SalesmenPanel\n') != 1:
    raise SystemExit(f'SalesmenPanel render mismatch: {app.count("<SalesmenPanel\\n")}')
app = app.replace('<SalesmenPanel\n', '<AdminEmployeesPanel\n', 1)
needle = '            leads={leads}\n            onAddClick='
if app.count(needle) != 1:
    raise SystemExit(f'employee panel props anchor mismatch: {app.count(needle)}')
app = app.replace(needle, '            leads={leads}\n            shared={{ T, inputStyle }}\n            onAddClick=', 1)

app_path.write_text(app)
print('Admin employees panel extracted to src/admin/AdminEmployeesPanel.jsx')
