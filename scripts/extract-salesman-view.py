from pathlib import Path

app_path = Path('src/App.jsx')
app = app_path.read_text()

start = app.index('function SalesmanView(')
big = app.index('\nfunction BigButton(', start)
after_big = app.index('\nconst DEFAULT_LEAD_SETTINGS', big)
view_block = app[start:big].rstrip()
big_block = app[big + 1:after_big].rstrip()

old_sig = 'function SalesmanView({ notificationLead, session, leads, dayStarted, allowLeadWithoutStartDay, onToggleDay, togglingDay, justToggledDay, onAddLead, onUpdateLeadStatus, onUpdateLeadDetails, online, gpsStatus, queuedCount, loadError, messages, onMarkMessageRead, onDeleteMessage, onReplyMessage, employeeRepliesEnabled = true, dailyTarget, monthlyTarget, page }) {'
new_sig = 'export default function SalesmanView({ notificationLead, session, leads, dayStarted, allowLeadWithoutStartDay, onToggleDay, togglingDay, justToggledDay, onAddLead, onUpdateLeadStatus, onUpdateLeadDetails, online, gpsStatus, queuedCount, loadError, messages, onMarkMessageRead, onDeleteMessage, onReplyMessage, employeeRepliesEnabled = true, dailyTarget, monthlyTarget, page, shared }) {\n  const { T, fmtMoney, isToday, isThisMonth, isWithinDays, isUpcomingRenewalMonth, SalesmanReportsPage, StatCard, MessagesSection, MyLeadsModal, AddLeadModal, LeadDetailDrawer } = shared;'
if old_sig not in view_block:
    raise SystemExit('SalesmanView signature not found')
view_block = view_block.replace(old_sig, new_sig, 1)
view_block = view_block.replace('<BigButton ', '<BigButton T={T} ')
big_block = big_block.replace('function BigButton({ icon: IconC, label, onClick, primary, disabled }) {', 'function BigButton({ T, icon: IconC, label, onClick, primary, disabled }) {', 1)

header = '''import React, { lazy, Suspense, useEffect, useRef, useState } from "react";\nimport { AlertTriangle, Play, Square, CheckCircle2, Loader2, WifiOff, Target as TargetIcon, Flame, MessageSquare, Handshake, CalendarClock, Plus, List } from "lucide-react";\nimport AdminMobileNav, { useAdminPhone, salesmanTabs } from "../AdminMobileNav.jsx";\nimport { api, mapLeadRow } from "../api.js";\nimport useSalesmanTasks from "../useSalesmanTasks.js";\nimport { showSaveFeedback } from "../saveFeedback.js";\n\nconst lazyNamed = (loader, exportName) => {\n  const LazyComponent = lazy(() => loader().then((mod) => ({ default: mod[exportName] })));\n  return function LazyFeature(props) {\n    return <Suspense fallback={<div style={{ padding: 12, textAlign: "center", color: "#6B7280", fontSize: 12 }}>Loading…</div>}><LazyComponent {...props} /></Suspense>;\n  };\n};\nconst TasksEntry = lazyNamed(() => import("../Tasks.jsx"), "TasksEntry");\nconst TasksModal = lazyNamed(() => import("../Tasks.jsx"), "TasksModal");\n\n'''

out = Path('src/salesman/SalesmanView.jsx')
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(header + view_block + '\n\n' + big_block + '\n')

import_anchor = 'import useSalesmanSettings from "./useSalesmanSettings.js";\n'
if app.count(import_anchor) != 1:
    raise SystemExit('import anchor mismatch')
app = app.replace(import_anchor, import_anchor + 'import SalesmanView from "./salesman/SalesmanView.jsx";\n', 1)

# Remove the old SalesmanView + BigButton implementations.
app = app[:start] + app[after_big:]

# Wire the shared legacy dependencies explicitly; no circular import from the feature module.
needle = '      page={page}\n    />'
replacement = '''      page={page}\n      shared={{\n        T, fmtMoney, isToday, isThisMonth, isWithinDays, isUpcomingRenewalMonth,\n        SalesmanReportsPage, StatCard, MessagesSection, MyLeadsModal, AddLeadModal, LeadDetailDrawer,\n      }}\n    />'''
if app.count(needle) != 1:
    raise SystemExit(f'SalesmanView render anchor mismatch: {app.count(needle)}')
app = app.replace(needle, replacement, 1)

# App no longer owns the salesman task bridge directly.
app = app.replace('import useSalesmanTasks from "./useSalesmanTasks.js";\n', '', 1)
app_path.write_text(app)
print('SalesmanView extracted to src/salesman/SalesmanView.jsx')
