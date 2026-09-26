from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
app_path=ROOT/'src'/'App.jsx'; main_path=ROOT/'src'/'main.jsx'; css_path=ROOT/'src'/'add-lead-polish.css'
app=app_path.read_text(); main=main_path.read_text(); css=css_path.read_text()

# Dedicated React overlay preserves the exact CSS hooks formerly added by MutationObserver.
anchor='''function AddLeadModal({ session, online, onClose, onSubmit, onSaved }) {'''
component='''function AddLeadOverlay({ onClose, children }) {\n  return (\n    <div className="engage-add-lead-overlay" style={{ position:"fixed", inset:0, zIndex:2000, background:"rgba(28,36,48,0.42)", display:"flex", alignItems:"flex-end", justifyContent:"center" }} onMouseDown={(e)=>{ if(e.target===e.currentTarget) onClose(); }}>\n      <section className="engage-mobile-add-lead-polish" role="dialog" aria-modal="true" aria-label="Add Lead" style={{ width:"100%", maxWidth:480, maxHeight:"88vh", overflowY:"auto", background:T.card, padding:18, boxSizing:"border-box" }} onMouseDown={(e)=>e.stopPropagation()}>\n        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:14 }}>\n          <div style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:700, fontSize:18 }}>Add Lead</div>\n          <button type="button" aria-label="Close Add Lead" onClick={onClose} style={{ border:"none", background:"transparent", cursor:"pointer", color:T.ink }}><X size={19}/></button>\n        </div>\n        {children}\n      </section>\n    </div>\n  );\n}\n\nfunction AddLeadModal({ session, online, onClose, onSubmit, onSaved }) {'''
if anchor not in app: raise SystemExit('AddLeadModal anchor missing')
app=app.replace(anchor,component,1)
app=app.replace('<Overlay onClose={onClose} title="Add Lead">','<AddLeadOverlay onClose={onClose}>',1)
# Only replace the matching close in AddLead function: the first </Overlay> after AddLeadModal start.
start=app.index('function AddLeadModal(')
close=app.index('</Overlay>',start)
app=app[:close]+'</AddLeadOverlay>'+app[close+len('</Overlay>'):]

# Section hooks are declared around the React section component.
app=app.replace('<AddLeadSection>Restaurant details</AddLeadSection>','<div data-mobile-lead-section="restaurant"><AddLeadSection>Restaurant details</AddLeadSection></div>',1)
app=app.replace('<AddLeadSection>Contact details</AddLeadSection>','<div data-mobile-lead-section="contact"><AddLeadSection>Contact details</AddLeadSection></div>',1)
app=app.replace('<AddLeadSection>Deal &amp; follow-up</AddLeadSection>','<div data-mobile-lead-section="deal"><AddLeadSection>Deal &amp; follow-up</AddLeadSection></div>',1)
app=app.replace('''      <AddLeadField label={`Stage${leadSettings.requireStatus ? " *" : ""}`}>\n        <select''','''      <div data-mobile-lead-stage="true"><AddLeadField label={`Stage${leadSettings.requireStatus ? " *" : ""}`}>\n        <select''',1)
app=app.replace('''        </select>\n      </AddLeadField>\n      <div style={{ display: "flex", gap: 10 }}>''','''        </select>\n      </AddLeadField></div>\n      <div style={{ display: "flex", gap: 10 }}>''',1)
app=app.replace('''      <AddLeadField label={`Comments${leadSettings.requireComments ? " *" : ""}`}>\n        <textarea''','''      <div data-mobile-lead-comments="true"><AddLeadField label={`Comments${leadSettings.requireComments ? " *" : ""}`}>\n        <textarea''',1)
app=app.replace('''        <textarea style={{ ...inputStyle, minHeight: 60 }} value={form.notes} onChange={set("notes")} />\n      </AddLeadField>''','''        <textarea style={{ ...inputStyle, minHeight: 60 }} value={form.notes} onChange={set("notes")} />\n      </AddLeadField></div>''',1)
# Save button hook: uniquely locate inside Add Lead by nearby disabled expression.
needle='''      <button\n        disabled={!canSubmit || submitting || duplicateResult?.blocking}'''
replace='''      <button\n        data-mobile-lead-save="true"\n        disabled={!canSubmit || submitting || duplicateResult?.blocking}'''
if needle not in app: raise SystemExit('Add Lead save button anchor missing')
app=app.replace(needle,replace,1)
app_path.write_text(app)

# Support wrapper-declared section hooks while retaining the same pseudo-icons.
css=css.replace('.engage-mobile-add-lead-polish [data-mobile-lead-section="restaurant"]::before { content: "▣"; }','.engage-mobile-add-lead-polish [data-mobile-lead-section="restaurant"] [role="heading"]::before { content: "▣"; }')
css=css.replace('.engage-mobile-add-lead-polish [data-mobile-lead-section="contact"]::before { content: "◯"; }','.engage-mobile-add-lead-polish [data-mobile-lead-section="contact"] [role="heading"]::before { content: "◯"; }')
css=css.replace('.engage-mobile-add-lead-polish [data-mobile-lead-section="deal"]::before { content: "▥"; }','.engage-mobile-add-lead-polish [data-mobile-lead-section="deal"] [role="heading"]::before { content: "▥"; }')
css_path.write_text(css)

main=main.replace('import "./mobileAddLeadPolish.js";\n','')
main_path.write_text(main)
print('Batch 7 applied')
