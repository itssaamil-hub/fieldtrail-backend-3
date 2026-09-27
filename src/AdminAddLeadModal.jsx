import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BriefcaseBusiness, CalendarClock, Contact2, IndianRupee, Loader2, MapPin, Plus, UserRound, X } from "lucide-react";
import { api } from "./api.js";

const C = {
  ink: "#17211F",
  soft: "#6B7280",
  line: "#E5E9E7",
  page: "#F5F7F6",
  card: "#FFFFFF",
  green: "#145C5D",
  greenSoft: "#EAF5F0",
  danger: "#C0392B",
  dangerSoft: "#FFF4F2",
  warn: "#A86E18",
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const STATUSES = [
  ["cold","Cold"],
  ["conversation","Conversation"],
  ["hot","Hot"],
  ["demo","Demo"],
  ["negotiation","Negotiation"],
  ["won","Won"],
  ["lost","Lost"],
  ["nurture","Nurture"],
];
const STATUS_TONE = {
  cold: ["#F3F4F6", "#4B5563"],
  conversation: ["#EAF1FF", "#315FB4"],
  hot: ["#FDECEC", "#C33F3F"],
  demo: ["#F2ECFF", "#7350A5"],
  negotiation: ["#FFF4DA", "#A06B12"],
  won: ["#E6F6EF", "#12805C"],
  lost: ["#F4F4F5", "#71717A"],
  nurture: ["#EAF6F8", "#287C88"],
};

const input = {
  width: "100%", height: 42, boxSizing: "border-box", border: `1px solid ${C.line}`,
  borderRadius: 10, padding: "0 12px", background: "#fff", color: C.ink,
  font: "500 13px Inter, system-ui, sans-serif", outline: "none",
};

function Field({ label, required, children }) {
  return <label style={{ display:"block", minWidth:0 }}>
    <div style={{ fontSize:12, fontWeight:700, color:C.ink, marginBottom:6 }}>{label}{required && <span style={{color:C.danger}}> *</span>}</div>
    {children}
  </label>;
}

function Card({ icon: Icon, title, subtitle, children }) {
  return <section style={{ background:C.card, border:`1px solid ${C.line}`, borderRadius:15, padding:18, boxShadow:"0 1px 2px rgba(20,40,35,.025)" }}>
    <div style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:16 }}>
      <div style={{ width:32, height:32, borderRadius:9, background:C.greenSoft, color:C.green, display:"grid", placeItems:"center", flexShrink:0 }}><Icon size={16}/></div>
      <div>
        <div style={{ fontSize:14.5, fontWeight:800, color:C.ink }}>{title}</div>
        {subtitle && <div style={{ fontSize:11.5, color:C.soft, marginTop:2 }}>{subtitle}</div>}
      </div>
    </div>
    {children}
  </section>;
}

function DuplicateWarning({ result }) {
  if (!result?.matches?.length) return null;
  const match = result.matches[0];
  const exact = match.matchType === "phone";
  return <div style={{ marginTop:10, padding:"10px 11px", borderRadius:10, border:`1px solid ${exact ? "#F1B6B0" : "#EAD39C"}`, background:exact ? C.dangerSoft : "#FFFAEA" }}>
    <div style={{ display:"flex", alignItems:"center", gap:7, fontSize:12, fontWeight:800, color:exact ? C.danger : C.warn }}><AlertTriangle size={14}/>{exact ? "Lead already exists" : "Possible duplicate"}</div>
    <div style={{ fontSize:12.5, fontWeight:750, marginTop:5 }}>{match.business_name}</div>
    <div style={{ fontSize:11.5, color:C.soft, marginTop:2 }}>{[match.sub_location, match.salesman_name ? `Assigned to ${match.salesman_name}` : null, match.phone].filter(Boolean).join(" · ")}</div>
    {result.blocking && <div style={{ fontSize:11, color:C.danger, marginTop:5 }}>This contact number is already in Engage, so another lead cannot be saved.</div>}
  </div>;
}

export default function AdminAddLeadModal({ salesmen, onClose, onSubmit }) {
  const activeSalesmen = useMemo(() => salesmen.filter((s) => s.isActive), [salesmen]);
  const [form, setForm] = useState({
    salesmanId: activeSalesmen[0]?.id || "", business:"", subLocation:"", posName:"",
    renewalMonth:"", renewalDate:"", owner:"", phone:"", status:"cold", notes:"",
    dealValue:"", nextFollowUpDate:"",
  });
  const [leadSettings, setLeadSettings] = useState(null);
  const [duplicateResult, setDuplicateResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));

  useEffect(() => {
    api.adminGetSettings().then((res) => setLeadSettings(res.leadSettings || null)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!leadSettings || leadSettings.duplicateProtectionEnabled === false) { setDuplicateResult(null); return; }
    if (!form.phone.trim() && !(form.business.trim() && form.subLocation.trim())) { setDuplicateResult(null); return; }
    const timer = setTimeout(() => {
      api.adminCheckDuplicateLead({ phone:form.phone, businessName:form.business, subLocation:form.subLocation })
        .then(setDuplicateResult).catch(() => setDuplicateResult(null));
    }, 450);
    return () => clearTimeout(timer);
  }, [form.phone, form.business, form.subLocation, leadSettings]);

  const canSubmit = !!form.salesmanId && !!form.business.trim() && (!leadSettings?.requireFollowUpDate || !!form.nextFollowUpDate);

  const save = async () => {
    if (!canSubmit || submitting || duplicateResult?.blocking) return;
    setSubmitting(true); setError("");
    try {
      await onSubmit({
        salesmanId:form.salesmanId,
        businessName:form.business.trim(),
        subLocation:form.subLocation || null,
        posName:form.posName || null,
        renewalMonth:form.renewalMonth || null,
        renewalDate:form.renewalDate || null,
        contactName:form.owner || null,
        phone:form.phone || null,
        status:form.status,
        notes:form.notes || null,
        dealValue:form.dealValue ? Number(form.dealValue) : null,
        nextFollowUpDate:form.nextFollowUpDate || null,
        allowDuplicate:duplicateResult?.allowOverride === true,
      });
    } catch (e) {
      setError(e.message || "Couldn't create that lead.");
      setSubmitting(false);
    }
  };

  return <div className="engage-admin-add-lead-v2" style={{ position:"fixed", inset:0, zIndex:2300, background:"rgba(24,34,32,.42)", display:"grid", placeItems:"center", padding:18 }} onMouseDown={(e)=>{ if(e.target===e.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label="Add Lead" style={{ width:"min(1180px, 100%)", maxHeight:"calc(100vh - 36px)", overflow:"auto", background:C.page, borderRadius:18, boxShadow:"0 24px 80px rgba(20,36,31,.22)" }} onMouseDown={(e)=>e.stopPropagation()}>
      <div style={{ position:"sticky", top:0, zIndex:3, background:"rgba(245,247,246,.96)", backdropFilter:"blur(10px)", borderBottom:`1px solid ${C.line}`, padding:"17px 22px 15px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:14 }}>
        <div>
          <button type="button" onClick={onClose} style={{ border:0, background:"transparent", padding:0, color:C.soft, fontSize:12.5, fontWeight:700, cursor:"pointer", marginBottom:7 }}>← Back to leads</button>
          <div style={{ fontSize:24, lineHeight:1.1, fontWeight:850, color:C.ink, letterSpacing:"-.4px" }}>Add Lead</div>
          <div style={{ fontSize:12.5, color:C.soft, marginTop:4 }}>Add a business lead and assign it to the right employee.</div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" style={{ width:36, height:36, borderRadius:10, border:`1px solid ${C.line}`, background:"#fff", color:C.ink, display:"grid", placeItems:"center", cursor:"pointer" }}><X size={17}/></button>
      </div>

      {activeSalesmen.length === 0 ? <div style={{ padding:28, color:C.soft, fontSize:13 }}>Add an active employee first before creating a lead for them.</div> : <>
        <div className="engage-admin-add-lead-grid" style={{ display:"grid", gridTemplateColumns:"minmax(0,1.45fr) minmax(330px,.85fr)", gap:14, padding:18 }}>
          <div style={{ display:"grid", gap:14, alignContent:"start" }}>
            <Card icon={BriefcaseBusiness} title="Business Information" subtitle="Basic details about the restaurant or business.">
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Field label="Business Name" required><input autoFocus value={form.business} onChange={set("business")} placeholder="e.g. Cafe 91" style={input}/></Field>
                <Field label="Sub Location / Branch"><input value={form.subLocation} onChange={set("subLocation")} placeholder="e.g. Gomti Nagar, Lucknow" style={input}/></Field>
                <Field label="Current POS"><input value={form.posName} onChange={set("posName")} placeholder="e.g. Petpooja" style={input}/></Field>
                <Field label="Renewal Month"><select value={form.renewalMonth} onChange={set("renewalMonth")} style={input}><option value="">Select renewal month</option>{MONTHS.map((m)=><option key={m}>{m}</option>)}</select></Field>
              </div>
            </Card>

            <Card icon={Contact2} title="Primary Contact" subtitle="Main contact person for this lead.">
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Field label="Contact Name"><input value={form.owner} onChange={set("owner")} placeholder="e.g. Rahul Sharma" style={input}/></Field>
                <Field label="Contact Number"><input value={form.phone} onChange={set("phone")} placeholder="e.g. 9876543210" inputMode="tel" style={input}/></Field>
              </div>
              <DuplicateWarning result={duplicateResult}/>
            </Card>

            <Card icon={CalendarClock} title="Deal & Follow-up" subtitle="Commercial details and the next sales action.">
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Field label="Next Follow-up" required={!!leadSettings?.requireFollowUpDate}><input type="date" value={form.nextFollowUpDate} onChange={set("nextFollowUpDate")} style={input}/></Field>
                <Field label="Renewal Date"><input type="date" value={form.renewalDate} onChange={set("renewalDate")} style={input}/></Field>
                <Field label="Expected Deal Value"><div style={{ position:"relative" }}><IndianRupee size={14} style={{ position:"absolute", left:11, top:14, color:C.soft }}/><input type="number" min="0" value={form.dealValue} onChange={set("dealValue")} placeholder="e.g. 50000" style={{...input,paddingLeft:31}}/></div></Field>
                <div style={{ display:"flex", alignItems:"end", paddingBottom:1 }}><div style={{ width:"100%", minHeight:42, borderRadius:10, background:C.greenSoft, color:C.green, padding:"8px 11px", boxSizing:"border-box", fontSize:11.5, lineHeight:1.35 }}><MapPin size={13} style={{verticalAlign:"-2px",marginRight:5}}/>Admin-created leads are assigned to the employee but do not create a GPS visit.</div></div>
              </div>
            </Card>
          </div>

          <div style={{ display:"grid", gap:14, alignContent:"start" }}>
            <Card icon={UserRound} title="Assignment & Status" subtitle="Choose the lead owner and starting pipeline stage.">
              <Field label="Assign to Employee" required>
                <select value={form.salesmanId} onChange={set("salesmanId")} style={input}>{activeSalesmen.map((s)=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
              </Field>
              <div style={{ marginTop:15, fontSize:12, fontWeight:700, color:C.ink }}>Initial Status</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginTop:8 }}>
                {STATUSES.map(([value,label])=>{ const selected=form.status===value; const [bg,color]=STATUS_TONE[value]; return <button key={value} type="button" onClick={()=>setForm((f)=>({...f,status:value}))} style={{ border:selected?`1px solid ${color}`:"1px solid transparent", background:bg, color, borderRadius:999, padding:"7px 11px", fontSize:11.5, fontWeight:800, cursor:"pointer", boxShadow:selected?`0 0 0 2px ${bg}`:"none" }}>{label}</button>; })}
              </div>
            </Card>

            <Card icon={Contact2} title="Notes" subtitle="Anything the employee should know before contacting this lead.">
              <textarea value={form.notes} onChange={set("notes")} maxLength={1000} placeholder="Write notes here…" style={{ ...input, height:150, padding:"11px 12px", resize:"vertical", lineHeight:1.5 }}/>
              <div style={{ textAlign:"right", fontSize:10.5, color:C.soft, marginTop:4 }}>{form.notes.length}/1000</div>
            </Card>
          </div>
        </div>

        {error && <div style={{ margin:"0 18px 12px", padding:"10px 12px", borderRadius:10, color:C.danger, background:C.dangerSoft, fontSize:12.5 }}>{error}</div>}

        <div style={{ position:"sticky", bottom:0, zIndex:3, background:"rgba(245,247,246,.96)", backdropFilter:"blur(10px)", borderTop:`1px solid ${C.line}`, padding:"13px 18px", display:"flex", justifyContent:"flex-end", gap:9 }}>
          <button type="button" onClick={onClose} style={{ height:42, minWidth:105, borderRadius:10, border:`1px solid ${C.line}`, background:"#fff", color:C.ink, fontSize:13, fontWeight:750, cursor:"pointer" }}>Cancel</button>
          <button type="button" onClick={save} disabled={!canSubmit || submitting || duplicateResult?.blocking} style={{ height:42, minWidth:170, borderRadius:10, border:0, background:canSubmit && !duplicateResult?.blocking ? C.green : "#BDC7C3", color:"#fff", fontSize:13, fontWeight:800, cursor:canSubmit && !submitting && !duplicateResult?.blocking ? "pointer" : "not-allowed", display:"inline-flex", alignItems:"center", justifyContent:"center", gap:7 }}>
            {submitting ? <Loader2 size={15} className="spin"/> : <Plus size={15}/>} {submitting ? "Adding…" : "Save Lead"}
          </button>
        </div>
      </>}

      <style>{`@media(max-width:850px){.engage-admin-add-lead-v2{padding:0!important;place-items:stretch!important}.engage-admin-add-lead-v2>div{max-height:100vh!important;border-radius:0!important}.engage-admin-add-lead-grid{grid-template-columns:1fr!important;padding:12px!important}.engage-admin-add-lead-grid section>div+div{grid-template-columns:1fr!important}}`}</style>
    </div>
  </div>;
}
