from pathlib import Path
import re

p = Path('src/App.jsx')
s = p.read_text()

old_sig = 'function LiveMap({ salesmen, leads, onSelectLead, title = "Live Employees & Lead Map", subtitle }) {'
new_sig = 'function LiveMap({ salesmen, leads, onSelectLead, title = "Live Employees & Lead Map", subtitle, headerControls }) {'
if old_sig not in s:
    raise SystemExit('LiveMap signature anchor not found')
s = s.replace(old_sig, new_sig, 1)

old_header = '''      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: subtitle ? 2 : 8 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}>{title}</div>
        {!subtitle && <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: T.verified, fontFamily: "'IBM Plex Mono', monospace" }}><Radio size={12} /> LIVE</div>}
      </div>'''
new_header = '''      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: subtitle ? 2 : 8, flexWrap: "wrap" }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}>{title}</div>
        {headerControls || (!subtitle && <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: T.verified, fontFamily: "'IBM Plex Mono', monospace" }}><Radio size={12} /> LIVE</div>)}
      </div>'''
if old_header not in s:
    raise SystemExit('LiveMap header anchor not found')
s = s.replace(old_header, new_header, 1)

pulse = re.compile(r'\n      \{!phone && salesmen\.length > 0 && \(\n        <div className="engage-map-team-pulse"[\s\S]*?\n      \)\}')
s, n = pulse.subn('', s, count=1)
if n != 1:
    raise SystemExit(f'Expected one team pulse block, removed {n}')

controls = re.compile(r'\n      <div style=\{\{ display: "flex", gap: 6, marginBottom: 10,[\s\S]*?<Radio size=\{12\} /> LIVE</span>\n      </div>')
s, n = controls.subn('', s, count=1)
if n != 1:
    raise SystemExit(f'Expected one external map controls row, removed {n}')

live_call = '          {showDashboard && <LiveMap salesmen={salesmen} leads={leads} onSelectLead={setSelectedLead} />}'
live_new = '''          {showDashboard && <LiveMap
            salesmen={salesmen}
            leads={leads}
            onSelectLead={setSelectedLead}
            headerControls={<div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Tab active={mapView === "live"} onClick={() => setMapView("live")} label="Live Map" />
              <Tab active={mapView === "leads"} onClick={() => setMapView("leads")} label="Lead Locations" />
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 9px", borderRadius: 999, background: T.verifiedSoft, color: T.verified, fontSize: 10.5, fontWeight: 800, letterSpacing: ".04em" }}><Radio size={12} /> LIVE</span>
            </div>}
          />}'''
if live_call not in s:
    raise SystemExit('Dashboard LiveMap call anchor not found')
s = s.replace(live_call, live_new, 1)

lead_call = '        <LiveMap salesmen={[]} leads={filteredLeads} onSelectLead={setSelectedLead} title="Lead Locations" subtitle="Respects the employee/status/date filters below" />'
lead_new = '''        <LiveMap
          salesmen={[]}
          leads={filteredLeads}
          onSelectLead={setSelectedLead}
          title="Live Employees & Lead Map"
          subtitle="Respects the employee/status/date filters below"
          headerControls={<div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Tab active={mapView === "live"} onClick={() => setMapView("live")} label="Live Map" />
            <Tab active={mapView === "leads"} onClick={() => setMapView("leads")} label="Lead Locations" />
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 9px", borderRadius: 999, background: T.verifiedSoft, color: T.verified, fontSize: 10.5, fontWeight: 800, letterSpacing: ".04em" }}><Radio size={12} /> LIVE</span>
          </div>}
        />'''
if lead_call not in s:
    raise SystemExit('Lead locations LiveMap call anchor not found')
s = s.replace(lead_call, lead_new, 1)

p.write_text(s)
