from pathlib import Path
import re

app_path = Path('src/App.jsx')
text = app_path.read_text()
start_marker = 'function DuplicateLeadWarning'
start = text.index(start_marker)
block = text[start:].rstrip() + '\n'

expected = [
  'DuplicateLeadWarning','AddLeadField','AddLeadSection','AdminAddLeadModal','SalesmanFormModal',
  'LeadDetailDrawer','SalesmanApp','adHocLeadFromPayload','MessagesSection','AddLeadOverlay','AddLeadModal',
  'GpsStatus','MyLeadsModal','EmbeddedLeads'
]
# Helpers in the block are intentionally kept beside the feature that owns them.
helper_names = ['isoDaysFromToday','whatsappLink']
for name in expected + helper_names:
    if not re.search(rf'^(?:function|const)\s+{re.escape(name)}\b', block, flags=re.M):
        raise SystemExit(f'missing expected lead symbol: {name}')

deps = [
  'React','useState','useEffect','useRef','useCallback','api','ApiError','T','inputStyle','STATUSES','STATUS_LABEL','MONTH_NAMES',
  'DEFAULT_LEAD_SETTINGS','DEFAULT_LOCATION_SETTINGS','uuid','fmtMoney','fmtTime','isToday','isThisMonth','isWithinDays',
  'isUpcomingRenewalMonth','LeadBriefPopup','buildLeadBrief','leadAvatarStyle','leadInitials','VerificationStamp','SyncBadge',
  'Overlay','Select','Field','StatCard','SalesmanReportsPage','showSaveFeedback','getDeviceId','getDayStarted','setDayStartedFlag',
  'mapLeadRow','useSalesmanMessages','useSalesmanSettings','useAttendanceGps','useSalesmanLeads','useAttendanceDay','SalesmanView',
  'DayClosingForm','Loader2','AlertTriangle','WifiOff','Navigation','Contact2','Search','List','Sparkles','Trash2','Pencil',
  'PhoneIcon','WhatsAppIcon','CalendarClock','CheckCircle2','MessageSquare','Handshake','Flame','TargetIcon','X','Clock','MapPin',
  'Wallet','Receipt','Route','Gauge','Battery','Plus','Square','Play'
]
used = [name for name in deps if re.search(rf'\b{re.escape(name)}\b', block)]
module = '''import React from "react";\n\n// Lead and salesman UI extracted from App.jsx without changing business behavior.\nexport function createLeadFeatures(deps) {\n  const { %s } = deps;\n\n%s\n\n  return { %s };\n}\n''' % (', '.join(used), block, ', '.join(expected))
Path('src/lead').mkdir(exist_ok=True)
Path('src/lead/LeadFeatures.jsx').write_text(module)

import_line = 'import { createLeadFeatures } from "./lead/LeadFeatures.jsx";\n'
anchor = 'import { createReportFeatures } from "./reports/ReportFeatures.jsx";\n'
if import_line not in text:
    if anchor not in text:
        raise SystemExit('report feature import anchor not found')
    text = text.replace(anchor, anchor + import_line, 1)

start = text.index(start_marker)
replacement = 'const { %s } = createLeadFeatures({ %s });\n' % (', '.join(expected), ', '.join(used))
text = text[:start] + replacement
app_path.write_text(text)
print('extracted', len(block.splitlines()), 'lead/salesman lines')
print('dependencies:', ', '.join(used))
print('App.jsx lines:', len(text.splitlines()))
