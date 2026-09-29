from pathlib import Path
import re

app_path = Path('src/App.jsx')
text = app_path.read_text()
start_marker = 'function DataQualityReport({ salesmen }) {'
end_marker = 'function DuplicateLeadWarning'
start = text.index(start_marker)
end = text.index(end_marker, start)
block = text[start:end].rstrip() + '\n'

names = re.findall(r'^function\s+([A-Za-z0-9_]+)\s*\(', block, flags=re.M)
expected = [
  'DataQualityReport','SalesmanPerformanceReport','FunnelReport','RenewalsReport','PaymentDueReport',
  'PaymentHistoryList','EditPaymentModal','RecordPaymentModal','ExpensesReport','ExpenseEditModal',
  'DailyActivityReport','TimeInStageReport','LeadExportReport','LeadsBoardView','EmptyReportState',
  'SalesmanReportsPage','MyPerformanceReport','SalesmanLeadsModal','SalesmanRouteModal','AttendanceSummary','MessageComposeModal'
]
missing = [name for name in expected if name not in names]
if missing:
    raise SystemExit(f'missing expected report functions: {missing}')

# Dependencies are supplied from App.jsx so this is a pure move: no report behavior is rewritten.
deps = [
  'React','useState','useEffect','useRef','useCallback','api','T','fmtMoney','fmtTime','isToday','isThisMonth',
  'STATUS_LABEL','STATUSES','inputStyle','Select','Overlay','Field','DownloadMenu','buildExportUrl','LeadBriefPopup',
  'buildLeadBrief','leadAvatarStyle','leadInitials','VerificationStamp','NoLocationBadge','SyncBadge','L',
  'EXPENSE_CATEGORIES','Loader2','CalendarClock','PhoneIcon','MapPin','Receipt','Wallet','CheckCircle2','RefreshCw',
  'BarChart3','Download','Route','Pencil','Trash2','MessageSquare','Search','X','Gauge','Clock','Battery','Navigation'
]
used = [name for name in deps if re.search(rf'\b{re.escape(name)}\b', block)]
module = '''import React from "react";\n\n// Extracted from App.jsx without changing report behavior.\n// Dependencies stay explicit so report UI remains testable and App.jsx stays orchestration-only.\nexport function createReportFeatures(deps) {\n  const { %s } = deps;\n\n%s\n\n  return { %s };\n}\n''' % (', '.join(used), block, ', '.join(expected))
Path('src/reports').mkdir(exist_ok=True)
Path('src/reports/ReportFeatures.jsx').write_text(module)

import_line = 'import { createReportFeatures } from "./reports/ReportFeatures.jsx";\n'
anchor = 'import useAdminData from "./admin/useAdminData.js";\n'
if import_line not in text:
    if anchor not in text:
        raise SystemExit('import anchor not found')
    text = text.replace(anchor, anchor + import_line, 1)

# Remove the original contiguous report implementation after import mutation using fresh markers.
start = text.index(start_marker)
end = text.index(end_marker, start)
used_props = ', '.join(used)
replacement = 'const { %s } = createReportFeatures({ %s });\n\n' % (', '.join(expected), used_props)
text = text[:start] + replacement + text[end:]
app_path.write_text(text)

print('extracted', len(block.splitlines()), 'report lines')
print('report functions:', ', '.join(expected))
print('dependencies:', ', '.join(used))
print('App.jsx lines:', len(text.splitlines()))
