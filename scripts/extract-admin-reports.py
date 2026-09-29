from pathlib import Path

path = Path('src/App.jsx')
app = path.read_text()

# Replace the reports page render with the dedicated feature shell.
needle = '        <ReportsPage salesmen={salesmen} leads={leads} />'
replacement = '''        <AdminReportsPage\n          salesmen={salesmen}\n          leads={leads}\n          shared={{\n            T, SalesmanPerformanceReport, FunnelReport, RenewalsReport, ExpensesReport,\n            TimeInStageReport, DataQualityReport, LeadExportReport,\n          }}\n        />'''
if app.count(needle) != 1:
    raise SystemExit(f'ReportsPage render mismatch: {app.count(needle)}')
app = app.replace(needle, replacement, 1)

# Remove the old report navigation shell, leaving the individual report implementations in App for now.
start = app.index('const REPORT_CARDS = [')
end = app.index('\nfunction DataQualityReport(', start)
app = app[:start] + app[end + 1:]

anchor = 'import AdminLeadsPanel from "./admin/AdminLeadsPanel.jsx";\n'
if app.count(anchor) != 1:
    raise SystemExit(f'import anchor mismatch: {app.count(anchor)}')
app = app.replace(anchor, anchor + 'import AdminReportsPage from "./admin/AdminReportsPage.jsx";\n', 1)

path.write_text(app)
print('Admin reports shell extracted to src/admin/AdminReportsPage.jsx')
