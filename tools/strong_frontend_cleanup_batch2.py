from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
app_path=ROOT/'src'/'App.jsx'
main_path=ROOT/'src'/'main.jsx'
app=app_path.read_text()
main=main_path.read_text()

pattern=re.compile(r'''\n\s*<div style=\{\{ fontSize: 11, textTransform: "uppercase", color: T\.inkSoft, fontWeight: 700, letterSpacing: 0\.4, marginTop: 22, marginBottom: 4 \}\}>Location Settings</div>\n\s*<SettingToggle\n\s*label="GPS Location".*?onChange=\{toggleLocation\("continuousGpsTracking"\)\}\n\s*/>\n''',re.S)
app,n=pattern.subn('\n',app,count=1)
if n!=1: raise SystemExit('Could not remove legacy global location settings block')

card_row='''      <div hidden={!showDashboard}>\n      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>'''
insert='''      <div hidden={!showDashboard}>\n      {!phone && (\n        <div className="engage-dashboard-greeting" style={{ minHeight: 44, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "0 2px", marginBottom: 8 }}>\n          <div style={{ minWidth: 0 }}>\n            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, lineHeight: 1.2, fontWeight: 700, letterSpacing: "-.25px", color: T.ink }}>\n              {new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening"}, {(getSession()?.fullName || getSession()?.full_name || getSession()?.name || "Admin").split(/\\s+/)[0]} 👋\n            </div>\n            <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 2 }}>A quick look at what needs your attention today.</div>\n          </div>\n          <select aria-label="Dashboard employee desktop" value={dashboardSalesman} onChange={(e) => setDashboardSalesman(e.target.value)} style={{ minWidth: 128, height: 34, padding: "5px 30px 5px 10px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, background: "#fff", border: `1px solid ${T.line}`, color: T.ink }}>\n            <option value="all">👥 All Team</option>\n            {salesmen.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}\n          </select>\n        </div>\n      )}\n      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>'''
if card_row not in app: raise SystemExit('Dashboard card row anchor missing')
app=app.replace(card_row,insert,1)

map_anchor='''      <TasksEntry />\n      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: phone ? "nowrap" : "wrap", alignItems: "center", width: phone ? "100%" : "auto" }}>'''
pulse='''      <TasksEntry />\n      {!phone && salesmen.length > 0 && (\n        <div className="engage-map-team-pulse" style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", margin: "0 0 10px", border: `1px solid ${T.line}`, borderRadius: 11, background: "#FBFCFC", overflowX: "auto" }}>\n          <strong style={{ fontSize: 11.5, color: T.ink, whiteSpace: "nowrap" }}>{salesmen.filter((s) => s.status === "online").length} live</strong>\n          {salesmen.slice().sort((a,b)=>(a.status === "online" ? 0 : 1)-(b.status === "online" ? 0 : 1)).map((s) => (\n            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 8px", borderRadius: 9, background: "#fff", border: `1px solid ${s.status === "online" ? "#D9EAE4" : T.line}`, flex: "none" }}>\n              <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.status === "online" ? T.verified : "#A4AAAC" }} />\n              <div style={{ lineHeight: 1.15 }}>\n                <div style={{ fontSize: 11, fontWeight: 700, color: T.ink, whiteSpace: "nowrap" }}>{s.name}</div>\n                <div style={{ fontSize: 9.5, color: T.inkSoft, whiteSpace: "nowrap" }}>{(s.distanceM / 1000).toFixed(1)} km · {fmtTime(s.lastUpdate)}</div>\n              </div>\n              <button type="button" onClick={() => setRouteSalesman(s)} style={{ border: 0, background: "#EDF7F5", color: T.route, borderRadius: 7, padding: "5px 7px", fontSize: 9.5, fontWeight: 750, cursor: "pointer" }}>Route</button>\n            </div>\n          ))}\n        </div>\n      )}\n      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: phone ? "nowrap" : "wrap", alignItems: "center", width: phone ? "100%" : "auto" }}>'''
if map_anchor not in app: raise SystemExit('Map control anchor missing')
app=app.replace(map_anchor,pulse,1)

old='''function StatCard({ label, value, sub, color, icon: IconC, onClick, comparison, comparisonPeriod, variant }) {\n  const c = color || T.ink;'''
new='''function StatCard({ label, value, sub, color, icon: IconC, onClick, comparison, comparisonPeriod, variant }) {\n  const labelText = typeof label === "string" ? label : "";\n  const salesmanKpi = ["Today", "Hot", "Conversation", "Negotiation", "Won", "Renewals"].includes(labelText);\n  const c = color || T.ink;'''
if old not in app: raise SystemExit('StatCard anchor missing')
app=app.replace(old,new,1)
app=app.replace('''className={onClick ? "ft-card ft-row" : "ft-card"}''','''className={`${onClick ? "ft-card ft-row" : "ft-card"}${salesmanKpi ? " engage-salesman-water-card" : ""}`} data-kpi={salesmanKpi ? labelText.toLowerCase() : undefined}''',1)

app_path.write_text(app)

for line in [
 'import "./dashboardTaskCard.js";\n',
 'import "./dashboardGreeting.js";\n',
 'import "./dashboardMapControls.js";\n',
 'import "./salesmanDashboardCards.js";\n',
 'import "./employeeLocationSettingsEnhance.js";\n',
]:
    main=main.replace(line,'')
main_path.write_text(main)
print('Batch 2 applied')
