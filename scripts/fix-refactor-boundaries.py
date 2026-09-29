from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'{label} marker not found in {path}')
    p.write_text(text.replace(old, new, 1))

# Shell feature: SettingsModal reads the current session.
replace_once(
    'src/app/AppShellFeatures.jsx',
    'api, ApiError, T, DASHBOARD_DISPLAY_KEY',
    'api, ApiError, getSession, T, DASHBOARD_DISPLAY_KEY',
    'shell getSession dependency',
)

# Reports: restore shared date helpers/icons/error class that remained outside the moved block.
replace_once(
    'src/reports/ReportFeatures.jsx',
    'api, T, fmtMoney, fmtTime, isToday, isThisMonth, STATUS_LABEL',
    'api, ApiError, T, fmtMoney, fmtTime, isToday, isThisMonth, isWithinDays, isUpcomingRenewalMonth, STATUS_LABEL',
    'report shared helpers',
)
replace_once(
    'src/reports/ReportFeatures.jsx',
    'Loader2, CalendarClock, PhoneIcon, MapPin',
    'Loader2, CalendarClock, TargetIcon, Contact2, PhoneIcon, MapPin',
    'report icons',
)
# This modal is admin-oriented and never had an employeeMobile prop; the old reference was undefined at runtime.
replace_once(
    'src/reports/ReportFeatures.jsx',
    'className={employeeMobile ? "ft-lead-brief-pill employee-mobile-brief-pill" : "ft-lead-brief-pill"}',
    'className="ft-lead-brief-pill"',
    'undefined employeeMobile reference',
)

# Admin orchestration: restore helpers/components used by the extracted block.
replace_once(
    'src/admin/AdminAppView.jsx',
    'isToday, comparisonFor, dailyComparisonFor',
    'isToday, isWithinDays, isUpcomingRenewalMonth, comparisonFor, dailyComparisonFor',
    'admin date helpers',
)
replace_once(
    'src/admin/AdminAppView.jsx',
    'MyLeadsModal, Overlay, Select, Tab, LegendDot',
    'MyLeadsModal, VerificationStamp, NoLocationBadge, leadAvatarStyle, leadInitials, Overlay, Select, Tab, LegendDot',
    'admin lead display helpers',
)
replace_once(
    'src/admin/AdminAppView.jsx',
    'AdminTeamActivitySheet, SalesmanBriefPopup, EmployeeSettings',
    'AdminTeamActivitySheet, SalesmanBriefPopup, EmployeeSettings, showSaveFeedback',
    'admin feedback helper',
)

# App factory calls must pass every restored dependency explicitly.
app = Path('src/App.jsx')
text = app.read_text()
old_shell = 'createAppShellFeatures({ useState, useEffect, useRef, useCallback, api, ApiError, T,'
new_shell = 'createAppShellFeatures({ useState, useEffect, useRef, useCallback, api, ApiError, getSession, T,'
if old_shell not in text: raise SystemExit('App shell call marker not found')
text = text.replace(old_shell, new_shell, 1)

old_report = 'createReportFeatures({ React, useState, useEffect, useRef, useCallback, api, T, fmtMoney, fmtTime, isToday, isThisMonth, STATUS_LABEL'
new_report = 'createReportFeatures({ React, useState, useEffect, useRef, useCallback, api, ApiError, T, fmtMoney, fmtTime, isToday, isThisMonth, isWithinDays, isUpcomingRenewalMonth, STATUS_LABEL'
if old_report not in text: raise SystemExit('App report call marker not found')
text = text.replace(old_report, new_report, 1)
text = text.replace('EXPENSE_CATEGORIES, Loader2, CalendarClock, PhoneIcon, MapPin', 'EXPENSE_CATEGORIES, Loader2, CalendarClock, TargetIcon, Contact2, PhoneIcon, MapPin', 1)

old_admin = 'createAdminAppView({ useState, useEffect, useRef, L, api, ApiError, T, fmtMoney, fmtTime, isToday, comparisonFor, dailyComparisonFor'
new_admin = 'createAdminAppView({ useState, useEffect, useRef, L, api, ApiError, T, fmtMoney, fmtTime, isToday, isWithinDays, isUpcomingRenewalMonth, comparisonFor, dailyComparisonFor'
if old_admin not in text: raise SystemExit('App admin call marker not found')
text = text.replace(old_admin, new_admin, 1)
text = text.replace('SalesmanFormModal, MyLeadsModal, Overlay, Select, Tab, LegendDot', 'SalesmanFormModal, MyLeadsModal, VerificationStamp, NoLocationBadge, leadAvatarStyle, leadInitials, Overlay, Select, Tab, LegendDot', 1)
text = text.replace('AdminTeamActivitySheet, SalesmanBriefPopup, EmployeeSettings });', 'AdminTeamActivitySheet, SalesmanBriefPopup, EmployeeSettings, showSaveFeedback });', 1)
app.write_text(text)

print('fixed extracted-module dependency boundaries and undefined employeeMobile reference')
