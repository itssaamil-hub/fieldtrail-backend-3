from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'src'

candidates = [
    'dashboardComparisons.js',
    'dashboardTaskCard.js',
    'dashboardGreeting.js',
    'dashboardMapControls.js',
    'salesmanDashboardCards.js',
    'adminMobileLeadTrend.js',
    'adminTeamActivity.js',
    'expenseReportEnhance.js',
    'pipelineEnhance.js',
    'employeePanelEnhance.js',
    'performanceReportEnhance.js',
    'performanceInsightsEnhance.js',
    'onboardingLiveShare.js',
    'quotationSettingsEnhance.js',
    'exceptionCentreMount.jsx',
    'exceptionCentreUxFix.js',
    'dataHealthEnhance.js',
    'employeeLocationSettingsEnhance.js',
    'renewalExpiryData.js',
    'mobileAddLeadPolish.js',
    'leadBusinessNameEditEnhance.js',
    'addLeadStageDropdown.js',
]

# Runtime entrypoint must contain no side-effect JavaScript enhancer imports.
main = (SRC / 'main.jsx').read_text()
for name in candidates:
    if name in main:
        raise SystemExit(f'Legacy runtime import still present: {name}')

# Delete a legacy file only after proving no other source file references it.
removed = []
for name in candidates:
    path = SRC / name
    if not path.exists():
        continue
    refs = []
    for other in SRC.rglob('*'):
        if not other.is_file() or other == path or other.suffix not in {'.js', '.jsx', '.ts', '.tsx', '.css'}:
            continue
        try:
            text = other.read_text()
        except UnicodeDecodeError:
            continue
        if name in text:
            refs.append(str(other.relative_to(ROOT)))
    if refs:
        raise SystemExit(f'{name} still referenced by: {refs}')
    path.unlink()
    removed.append(name)

# Temporary one-time migration tooling should not remain in production repo.
for path in list((ROOT / 'tools').glob('strong_frontend_cleanup*.py')):
    path.unlink()
for path in list((ROOT / '.github' / 'workflows').glob('strong-frontend-cleanup*.yml')):
    path.unlink()

# This final script/workflow are removed by the job after execution, so production
# does not retain one-time migration machinery.
print('Removed legacy enhancer files:', ', '.join(removed) if removed else 'none')
