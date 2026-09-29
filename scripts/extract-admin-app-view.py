from pathlib import Path
import re

app_path = Path('src/App.jsx')
text = app_path.read_text()
start_marker = 'function LiveMap'
end_marker = '// A little more visual flair than a plain bar'
start = text.index(start_marker)
end = text.index(end_marker, start)
block = text[start:end].rstrip() + '\n'

expected = ['LiveMap','AdminApp','AdminView']
for name in expected:
    if not re.search(rf'^function\s+{re.escape(name)}\b', block, flags=re.M):
        raise SystemExit(f'missing expected admin function: {name}')

declared = set(re.findall(r'^(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)', block, flags=re.M))
candidates = [
  'React','useState','useEffect','useRef','useCallback','L','api','ApiError','T','fmtMoney','fmtTime','isToday','isThisMonth',
  'comparisonFor','dailyComparisonFor','getDashboardDisplaySettings','STATUS_LABEL','STATUSES','useAdminPhone','AdminMobileNav',
  'DesktopSidebar','useDesktopSidebar','AdminActivityOverview','AdminAddLeadModalV2','AdminEmployeesPanel','AdminDashboardPanel',
  'AdminLeadsPanel','AdminReportsPage','useAdminData','ExceptionCentre','DataHealth','AttendanceReport','EnhancedDailyActivityReport',
  'CollectionsEntry','QuotationsPanel','TasksEntry','TasksModal','DealValueReport','DayClosingReportsEntry','DataQualityReport',
  'SalesmanPerformanceReport','FunnelReport','RenewalsReport','PaymentDueReport','ExpensesReport','DailyActivityReport',
  'TimeInStageReport','LeadExportReport','LeadsBoardView','AttendanceSummary','MessageComposeModal','LeadDetailDrawer',
  'SalesmanFormModal','MyLeadsModal','Overlay','Select','Tab','LegendDot','DownloadMenu','inputStyle','EXPENSE_CATEGORIES',
  'mapLeadRow','buildExportUrl','Loader2','Radio','Lock','LockOpen','MapPin','Battery','Gauge','Clock','CheckCircle2',
  'AlertTriangle','Plus','List','X','Navigation','Download','RefreshCw','Settings','Trash2','MessageSquare','Search','Flame',
  'Handshake','CalendarClock','TargetIcon','BarChart3','Wallet','Receipt','LayoutGrid','Bell','PhoneIcon','WhatsAppIcon','Route',
  'Pencil','Sparkles','AdminMobileLeadTrend','AdminTeamActivitySheet','SalesmanBriefPopup','EmployeeSettings','QuotationSettings',
  'OnboardingTemplateEditor'
]
used = [name for name in candidates if name not in declared and re.search(rf'\b{re.escape(name)}\b', block)]

module = '''import React from "react";\n\n// Admin map and orchestration extracted from App.jsx without changing behavior.\nexport function createAdminAppView(deps) {\n  const { %s } = deps;\n\n%s\n\n  return { LiveMap, AdminApp, AdminView };\n}\n''' % (', '.join(used), block)
Path('src/admin').mkdir(exist_ok=True)
Path('src/admin/AdminAppView.jsx').write_text(module)

import_line = 'import { createAdminAppView } from "./admin/AdminAppView.jsx";\n'
anchor = 'import { createAppShellFeatures } from "./app/AppShellFeatures.jsx";\n'
if import_line not in text:
    if anchor not in text:
        raise SystemExit('app shell import anchor not found')
    text = text.replace(anchor, anchor + import_line, 1)

start = text.index(start_marker)
end = text.index(end_marker, start)
text = text[:start] + text[end:]

lead_factory = 'const { DuplicateLeadWarning, AddLeadField, AddLeadSection, AdminAddLeadModal, SalesmanFormModal, LeadDetailDrawer, SalesmanApp, adHocLeadFromPayload, MessagesSection, AddLeadOverlay, AddLeadModal, GpsStatus, MyLeadsModal, EmbeddedLeads } = createLeadFeatures('
lead_pos = text.index(lead_factory)
lead_end = text.index('\n', lead_pos)
instantiation = '\n\nconst { LiveMap, AdminApp, AdminView } = createAdminAppView({ %s });' % ', '.join(used)
text = text[:lead_end] + instantiation + text[lead_end:]
app_path.write_text(text)

print('extracted', len(block.splitlines()), 'admin orchestration lines')
print('dependencies:', ', '.join(used))
print('App.jsx lines:', len(text.splitlines()))
