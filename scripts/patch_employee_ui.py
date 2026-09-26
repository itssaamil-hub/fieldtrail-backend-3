from pathlib import Path

app = Path('src/App.jsx')
text = app.read_text()
old_brief = 'className="ft-lead-brief-pill" aria-label={`Brief for ${l.business}`}'
new_brief = 'className={employeeMobile ? "ft-lead-brief-pill employee-mobile-brief-pill" : "ft-lead-brief-pill"} aria-label={`Brief for ${l.business}`}'
assert old_brief in text, 'Brief button class not found'
text = text.replace(old_brief, new_brief, 1)

old_bell = 'title="Notifications" aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"} style={{ position: "relative", display: "flex"'
new_bell = 'title="Notifications" aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"} className={session?.role === "salesman" ? "employee-notification-button" : undefined} style={{ position: "relative", display: "flex"'
assert old_bell in text, 'Notification button not found'
text = text.replace(old_bell, new_bell, 1)
app.write_text(text)

css = Path('src/index.css')
css_text = css.read_text()
marker = '/* Employee phone: violet Brief pill + external notification badge. */'
if marker not in css_text:
    css_text += '''\n\n/* Employee phone: violet Brief pill + external notification badge. */
.employee-mobile-brief-pill {
  background: #F1EAFE !important;
  color: #7450C7 !important;
  border-color: transparent !important;
  box-shadow: none !important;
}
.employee-mobile-brief-pill svg {
  color: #7450C7 !important;
  stroke: #7450C7 !important;
}
.employee-notification-button {
  overflow: visible !important;
}
.employee-notification-button .ft-notification-badge {
  position: absolute !important;
  top: -7px !important;
  right: -7px !important;
  min-width: 17px !important;
  height: 17px !important;
  padding: 0 4px !important;
  border-radius: 999px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  background: #E53935 !important;
  color: #fff !important;
  border: 2px solid #145C5D !important;
  font-size: 9.5px !important;
  font-weight: 800 !important;
  line-height: 1 !important;
  pointer-events: none !important;
  z-index: 2 !important;
}
'''
    css.write_text(css_text)
