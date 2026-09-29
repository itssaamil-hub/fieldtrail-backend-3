from pathlib import Path

shell_path = Path('src/app/AppShellFeatures.jsx')
shell = shell_path.read_text()
old_return = 'return { LogoMark, TopBar, ConnectionPill, ConnectBackendScreen, LoginScreen, SettingsModal, StatCard, VerificationStamp, SyncBadge, NoLocationBadge, SettingToggle, AddExpenseModal, CrmSettingsModal, FieldOptionsSection, DownloadMenu, Tab, Select, LegendDot, Field, Overlay };'
new_return = 'return { LogoMark, TopBar, ConnectionPill, ConnectBackendScreen, LoginScreen, SettingsModal, StatCard, VerificationStamp, SyncBadge, NoLocationBadge, SettingToggle, AddExpenseModal, CrmSettingsModal, FieldOptionsSection, DownloadMenu, Tab, Select, LegendDot, Field, Overlay, inputStyle, EXPENSE_CATEGORIES };'
if old_return not in shell:
    raise SystemExit('shell return marker not found')
shell_path.write_text(shell.replace(old_return, new_return, 1))

app_path = Path('src/App.jsx')
app = app_path.read_text()
old = 'const { LogoMark, TopBar, ConnectionPill, ConnectBackendScreen, LoginScreen, SettingsModal, StatCard, VerificationStamp, SyncBadge, NoLocationBadge, SettingToggle, AddExpenseModal, CrmSettingsModal, FieldOptionsSection, DownloadMenu, Tab, Select, LegendDot, Field, Overlay } = createAppShellFeatures('
new = 'const { LogoMark, TopBar, ConnectionPill, ConnectBackendScreen, LoginScreen, SettingsModal, StatCard, VerificationStamp, SyncBadge, NoLocationBadge, SettingToggle, AddExpenseModal, CrmSettingsModal, FieldOptionsSection, DownloadMenu, Tab, Select, LegendDot, Field, Overlay, inputStyle, EXPENSE_CATEGORIES } = createAppShellFeatures('
if old not in app:
    raise SystemExit('App shell destructure marker not found')
app_path.write_text(app.replace(old, new, 1))
print('restored inputStyle and EXPENSE_CATEGORIES across shell boundary')
