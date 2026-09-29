from pathlib import Path
import re

app_path = Path('src/App.jsx')
text = app_path.read_text()
start_marker = 'function LogoMark'
end_marker = 'function LiveMap'
start = text.index(start_marker)
end = text.index(end_marker, start)
block = text[start:end].rstrip() + '\n'

expected = [
  'LogoMark','TopBar','ConnectionPill','ConnectBackendScreen','LoginScreen','SettingsModal','StatCard',
  'VerificationStamp','SyncBadge','NoLocationBadge','SettingToggle','AddExpenseModal','CrmSettingsModal',
  'FieldOptionsSection','DownloadMenu','Tab','Select','LegendDot','Field','Overlay'
]
for name in expected:
    if not re.search(rf'^function\s+{re.escape(name)}\b', block, flags=re.M):
        raise SystemExit(f'missing expected app shell function: {name}')

# Never inject a dependency that the extracted block itself declares.
declared = set(re.findall(r'^(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)', block, flags=re.M))
candidates = [
  'React','useState','useEffect','useRef','useCallback','api','ApiError','T','inputStyle','getApiBase','setSession','clearSession',
  'DASHBOARD_DISPLAY_KEY','getDashboardDisplaySettings','mapSalesmanRow','buildExportUrl','AppMenu','EmployeeSettings',
  'QuotationSettings','OnboardingTemplateEditor','DataHealth','Loader2','Gauge','BarChart3','Wallet','Bell','WifiOff',
  'Settings','LogOut','Download','RefreshCw','Lock','LockOpen','X','Plus','Trash2','Pencil','Receipt','MapPin','Camera',
  'Navigation','CheckCircle2','AlertTriangle','Contact2','Route','Clock','Battery','MessageSquare','CalendarClock','Search',
  'showSaveFeedback'
]
used = [name for name in candidates if name not in declared and re.search(rf'\b{re.escape(name)}\b', block)]

module = '''import React from "react";\n\n// Shared application shell/settings UI extracted from App.jsx without changing behavior.\nexport function createAppShellFeatures(deps) {\n  const { %s } = deps;\n\n%s\n\n  return { %s };\n}\n''' % (', '.join(used), block, ', '.join(expected))
Path('src/app').mkdir(exist_ok=True)
Path('src/app/AppShellFeatures.jsx').write_text(module)

import_line = 'import { createAppShellFeatures } from "./app/AppShellFeatures.jsx";\n'
anchor = 'import { createLeadFeatures } from "./lead/LeadFeatures.jsx";\n'
if import_line not in text:
    if anchor not in text:
        raise SystemExit('lead feature import anchor not found')
    text = text.replace(anchor, anchor + import_line, 1)

start = text.index(start_marker)
end = text.index(end_marker, start)
replacement = 'const { %s } = createAppShellFeatures({ %s });\n\n' % (', '.join(expected), ', '.join(used))
text = text[:start] + replacement + text[end:]
app_path.write_text(text)

print('extracted', len(block.splitlines()), 'app-shell lines')
print('declared in block:', ', '.join(sorted(declared)))
print('dependencies:', ', '.join(used))
print('App.jsx lines:', len(text.splitlines()))
