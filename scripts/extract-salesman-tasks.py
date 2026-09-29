from pathlib import Path

path = Path("src/App.jsx")
text = path.read_text()

import_old = 'import useSalesmanLeads from "./useSalesmanLeads.js";\n'
import_new = import_old + 'import useSalesmanTasks from "./useSalesmanTasks.js";\n'
if text.count(import_old) != 1:
    raise SystemExit(f"tasks import anchor: expected 1 match, found {text.count(import_old)}")
text = text.replace(import_old, import_new, 1)

app_start = text.index("function SalesmanView({ notificationLead, session, leads, dayStarted, allowLeadWithoutStartDay, onToggleDay, togglingDay, justToggledDay, onAddLead, onUpdateLeadStatus, onUpdateLeadDetails, online, gpsStatus, queuedCount, loadError, messages, onMarkMessageRead, onDeleteMessage, onReplyMessage, employeeRepliesEnabled = true, dailyTarget, monthlyTarget, page }) {")
segment = text[app_start:]
old_state = '  const [pendingTasks, setPendingTasks] = useState(null);\n'
new_state = '  const { pendingTasks, handlePendingTasksChange } = useSalesmanTasks();\n'
if segment.count(old_state) != 1:
    raise SystemExit(f"tasks state: expected 1 match in SalesmanView, found {segment.count(old_state)}")
segment = segment.replace(old_state, new_state, 1)
old_entry = '<TasksEntry onPendingChange={setPendingTasks} />'
new_entry = '<TasksEntry onPendingChange={handlePendingTasksChange} />'
if segment.count(old_entry) != 1:
    raise SystemExit(f"tasks entry: expected 1 match in SalesmanView, found {segment.count(old_entry)}")
segment = segment.replace(old_entry, new_entry, 1)
text = text[:app_start] + segment
path.write_text(text)
print("salesman tasks bridge extracted")
