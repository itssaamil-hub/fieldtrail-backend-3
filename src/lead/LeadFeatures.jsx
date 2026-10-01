import React from "react";

// Lead and salesman UI extracted from App.jsx without changing business behavior.
export function createLeadFeatures(deps) {
  const { useState, useEffect, useRef, useCallback, api, ApiError, T, inputStyle, STATUSES, STATUS_LABEL, MONTH_NAMES, uuid, fmtMoney, fmtTime, isToday, isThisMonth, isWithinDays, isUpcomingRenewalMonth, LeadBriefPopup, buildLeadBrief, leadAvatarStyle, leadInitials, VerificationStamp, SyncBadge, NoLocationBadge, Overlay, Select, Field, StatCard, SalesmanReportsPage, TasksEntry, getDeviceId, getDayStarted, setDayStartedFlag, useSalesmanMessages, useSalesmanSettings, useAttendanceGps, useSalesmanLeads, useAttendanceDay, SalesmanView, DayClosingForm, Loader2, AlertTriangle, WifiOff, Navigation, Contact2, Search, List, Sparkles, Trash2, PhoneIcon, WhatsAppIcon, MessageSquare, X } = deps;

function DuplicateLeadWarning({ result }) {
  if (!result?.matches?.length) return null;
  const m = result.matches[0];
  const exact = m.matchType === "phone";
  return (
    <div style={{ border: `1px solid ${exact ? "#F4B8B8" : "#F0D69A"}`, background: exact ? "#FFF5F5" : "#FFFBEB", borderRadius: 11, padding: "10px 11px", margin: "-2px 0 12px" }}>
      <div style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 12.5, fontWeight: 800, color: exact ? T.danger : T.warn }}><AlertTriangle size={14} /> {exact ? "Lead already exists" : "Possible duplicate found"}</div>
      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6 }}>{m.business_name}</div>
      <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>{[m.sub_location, m.salesman_name ? `Assigned to ${m.salesman_name}` : null, m.phone].filter(Boolean).join(" · ")}</div>
      {result.blocking && <div style={{ fontSize: 11.5, color: T.danger, marginTop: 6 }}>This contact number is already in Engage, so a second lead cannot be saved.</div>}
    </div>
  );
}

// Compact presentation shared only by the two Add Lead forms.
function AddLeadField({ label, children }) {
  return <div style={{ marginBottom: 8, minWidth: 0 }}><div style={{ fontSize: 11.5, color: T.inkSoft, fontWeight: 600, marginBottom: 4 }}>{label}</div>{children}</div>;
}

function AddLeadSection({ children }) {
  return <div role="heading" aria-level={3} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, fontWeight: 700, color: T.route, marginBottom: 6 }}><span>{children}</span><span aria-hidden="true" style={{ flex: 1, height: 1, background: T.line }} /></div>;
}

function AdminAddLeadModal({ salesmen, onClose, onSubmit }) {
  const activeSalesmen = salesmen.filter((s) => s.isActive);
  const [form, setForm] = useState({
    salesmanId: activeSalesmen[0]?.id || "",
    business: "", subLocation: "", posName: "", renewalMonth: "", renewalDate: "",
    owner: "", phone: "", status: "cold", notes: "", dealValue: "", nextFollowUpDate: "",
  });
  const [leadSettings, setLeadSettings] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [duplicateResult, setDuplicateResult] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    api.adminGetSettings().then((res) => setLeadSettings(res.leadSettings || null)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!leadSettings || leadSettings.duplicateProtectionEnabled === false) { setDuplicateResult(null); return; }
    if (!form.phone.trim() && !(form.business.trim() && form.subLocation.trim())) { setDuplicateResult(null); return; }
    const timer = setTimeout(() => {
      api.adminCheckDuplicateLead({ phone: form.phone, businessName: form.business, subLocation: form.subLocation })
        .then(setDuplicateResult).catch(() => setDuplicateResult(null));
    }, 450);
    return () => clearTimeout(timer);
  }, [form.phone, form.business, form.subLocation, leadSettings]);

  const canSubmit =
    form.salesmanId && form.business.trim().length > 0 &&
    (!leadSettings?.requireFollowUpDate || form.nextFollowUpDate.trim().length > 0);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({
        salesmanId: form.salesmanId,
        businessName: form.business.trim(),
        subLocation: form.subLocation || null,
        posName: form.posName || null,
        renewalMonth: form.renewalMonth || null,
        renewalDate: form.renewalDate || null,
        contactName: form.owner || null,
        phone: form.phone || null,
        status: form.status,
        notes: form.notes || null,
        dealValue: form.dealValue ? Number(form.dealValue) : null,
        nextFollowUpDate: form.nextFollowUpDate || null,
        allowDuplicate: duplicateResult?.allowOverride === true,
      });
    } catch (err) {
      setError(err.message || "Couldn't create that lead.");
      setSubmitting(false);
    }
  };

  return (
    <Overlay onClose={onClose} title="Add Lead">
      {activeSalesmen.length === 0 ? (
        <div style={{ fontSize: 13, color: T.inkSoft }}>Add an active employee first before creating a lead for them.</div>
      ) : (
        <>
          <AddLeadField label="Assign to">
            <select style={inputStyle} value={form.salesmanId} onChange={set("salesmanId")}>
              {activeSalesmen.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </AddLeadField>
          <AddLeadSection>Restaurant details</AddLeadSection>
          <AddLeadField label="Business Name"><input style={inputStyle} value={form.business} onChange={set("business")} placeholder="e.g. Ganga Cafe" autoFocus /></AddLeadField>
          <AddLeadField label="Sub Location"><input style={inputStyle} value={form.subLocation} onChange={set("subLocation")} /></AddLeadField>
          <AddLeadField label="POS Name"><input style={inputStyle} value={form.posName} onChange={set("posName")} /></AddLeadField>
          <AddLeadSection>Contact details</AddLeadSection>
          <AddLeadField label="Contact Name"><input style={inputStyle} value={form.owner} onChange={set("owner")} /></AddLeadField>
          <AddLeadField label="Contact Number"><input style={inputStyle} value={form.phone} onChange={set("phone")} /></AddLeadField>
          <DuplicateLeadWarning result={duplicateResult} />
          <AddLeadSection>Deal &amp; follow-up</AddLeadSection>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}><AddLeadField label="Renewal Month">
              <select style={inputStyle} value={form.renewalMonth} onChange={set("renewalMonth")}>
                <option value="">Select…</option>
                {MONTH_NAMES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </AddLeadField></div>
            <div style={{ flex: 1, minWidth: 0 }}><AddLeadField label="Renewal Date"><input style={inputStyle} type="date" value={form.renewalDate} onChange={set("renewalDate")} /></AddLeadField></div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}><AddLeadField label="Stage">
              <select style={inputStyle} value={form.status} onChange={set("status")}>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </AddLeadField></div>
            <div style={{ flex: 1, minWidth: 0 }}><AddLeadField label={`Next Follow-up${leadSettings?.requireFollowUpDate ? " *" : ""}`}><input style={inputStyle} type="date" value={form.nextFollowUpDate} onChange={set("nextFollowUpDate")} /></AddLeadField></div>
          </div>
          <AddLeadField label="Expected Deal Value"><input style={inputStyle} type="number" min="0" value={form.dealValue} onChange={set("dealValue")} placeholder="₹ e.g. 45000" /></AddLeadField>
          <AddLeadField label="Comments"><textarea style={{ ...inputStyle, minHeight: 60 }} value={form.notes} onChange={set("notes")} /></AddLeadField>

          {error && <div style={{ fontSize: 12.5, color: T.danger, marginBottom: 10 }}>{error}</div>}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting || duplicateResult?.blocking}
            style={{ width: "100%", padding: "12px", borderRadius: 11, border: "none", cursor: canSubmit && !submitting && !duplicateResult?.blocking ? "pointer" : "not-allowed", background: canSubmit && !duplicateResult?.blocking ? T.route : "#C7CDD6", color: "#fff", fontWeight: 700, fontSize: 14.5 }}
          >
            {submitting ? "Adding…" : "Add Lead"}
          </button>
        </>
      )}
    </Overlay>
  );
}

function SalesmanFormModal({ existingCount, salesman, onClose, onSubmit }) {
  const isEdit = !!salesman;
  const [form, setForm] = useState({
    name: salesman?.name || "", phone: salesman?.phone || "", password: "",
    area: salesman?.area && salesman.area !== "Unassigned" ? salesman.area : "",
    employeeCode: salesman?.employeeCode || "", dailyTarget: String(salesman?.dailyTarget || 8),
    monthlyTarget: String(salesman?.monthlyTarget || 200),
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const canSubmit = form.name.trim().length > 0 && form.phone.trim().length > 0 && (isEdit || form.password.length >= 6);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        fullName: form.name.trim(),
        phone: form.phone.trim(),
        employeeCode: form.employeeCode.trim() || (isEdit ? null : `EMP-${1000 + existingCount + 1}`),
        dailyTarget: Number(form.dailyTarget) || 8,
        monthlyTarget: Number(form.monthlyTarget) || 200,
        area: form.area.trim() || null,
      };
      if (form.password) payload.password = form.password; // only send if actually changing it
      await onSubmit(payload);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Couldn't ${isEdit ? "save changes" : "create employee"}.`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Overlay onClose={onClose} title={isEdit ? "Edit Employee" : "Add Employee"}>
      {!isEdit && (
        <div style={{ fontSize: 12, color: T.inkSoft, background: T.paperDeep, borderRadius: 11, padding: "8px 10px", marginBottom: 14 }}>
          They'll show up as <strong>OFFLINE</strong> on the map until they install Engage, sign in with this phone + password, and tap Start Day.
        </div>
      )}
      <Field label="Full name *"><input style={inputStyle} value={form.name} onChange={set("name")} placeholder="e.g. Priya Sharma" /></Field>
      <Field label="Phone number * (their login)"><input style={inputStyle} value={form.phone} onChange={set("phone")} placeholder="10-digit phone" inputMode="tel" /></Field>
      <Field label={isEdit ? "Password (leave blank to keep current)" : "Password * (min 6 characters, share with them securely)"}>
        <input style={inputStyle} type="text" value={form.password} onChange={set("password")} placeholder={isEdit ? "Leave blank to keep unchanged" : "Set an initial password"} />
      </Field>
      <Field label="Area / territory"><input style={inputStyle} value={form.area} onChange={set("area")} placeholder="e.g. Alambagh" /></Field>
      <Field label="Employee code"><input style={inputStyle} value={form.employeeCode} onChange={set("employeeCode")} placeholder="Auto-generated if left blank" /></Field>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><Field label="Daily lead target"><input style={inputStyle} type="number" min="1" value={form.dailyTarget} onChange={set("dailyTarget")} /></Field></div>
        <div style={{ flex: 1 }}><Field label="Monthly lead target"><input style={inputStyle} type="number" min="1" value={form.monthlyTarget} onChange={set("monthlyTarget")} /></Field></div>
      </div>
      {error && <div style={{ fontSize: 12.5, color: T.danger, background: T.dangerSoft, borderRadius: 11, padding: "8px 10px", marginBottom: 12 }}>{error}</div>}
      <button
        disabled={!canSubmit || submitting}
        onClick={handleSubmit}
        style={{ width: "100%", padding: "12px", borderRadius: 11, border: "none", cursor: canSubmit ? "pointer" : "not-allowed", background: canSubmit ? T.route : "#C7CDD6", color: "#fff", fontWeight: 700, fontSize: 14.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
      >
        {submitting && <Loader2 size={16} className="spin" />}
        {submitting ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save changes" : "Create Employee")}
      </button>
    </Overlay>
  );
}

// Shared between Admin and Salesman — the fields shown adapt automatically
// to whatever the lead actually has (nullable GPS when Location Settings
// have GPS off, optional sub-location/POS/renewal fields, etc).
const FOLLOWUP_QUICK = [["Tomorrow", 1], ["+3 days", 3]];
function isoDaysFromToday(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
// wa.me needs the country code. Indian numbers are often saved as 10 digits or with a leading 0.
function whatsappLink(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = "91" + digits;
  return `https://wa.me/${digits}`;
}

function LeadDetailDrawer({ lead, onClose, onStatusChange, onUpdate, onDelete, fetchHistory, isAdmin = false, employeeRepliesEnabled = true }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [history, setHistory] = useState(null); // null = loading, [] = loaded & empty
  const [historyError, setHistoryError] = useState("");
  const [showBrief, setShowBrief] = useState(false);
  const [detailTab, setDetailTab] = useState("overview");
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [followUpSaving, setFollowUpSaving] = useState(false);
  const [followUpExpanded, setFollowUpExpanded] = useState(false);
  const [statusExpanded, setStatusExpanded] = useState(false);
  const [statusToast, setStatusToast] = useState(null);
  const statusToastTimer = useRef(null);
  const [mentionText, setMentionText] = useState(isAdmin && lead.salesmanName ? `@${lead.salesmanName} ` : "");
  const [mentionSending, setMentionSending] = useState(false);
  const [mentionError, setMentionError] = useState("");
  const [mentionSaved, setMentionSaved] = useState("");
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [showLeadConversation, setShowLeadConversation] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const [form, setForm] = useState({
    business: lead.business || "", subLocation: lead.subLocation || "", posName: lead.posName || "",
    renewalMonth: lead.renewalMonth || "", renewalDate: lead.renewalDate || "",
    owner: lead.owner || "", phone: lead.phone || "", notes: lead.notes || "",
    dealValue: lead.dealValue != null ? String(lead.dealValue) : "",
    nextFollowUpDate: lead.nextFollowUpDate || "",
    wonDate: lead.wonDate || "",
  });
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [savedOverrides, setSavedOverrides] = useState({}); // reflects the drawer's own last successful save immediately, so it never shows stale data while waiting on a full reload
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const displayLead = { ...lead, ...savedOverrides };

  // Compact sales-age indicators for the header.
  const ageInDays = (value) => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.max(0, Math.floor((today - start) / 86400000));
  };
  const dealAgeDays = ageInDays(displayLead.createdAt || displayLead.created_at);
  const latestStatusChange = history && history.length
    ? [...history].filter((h) => (h.action || "lead.status_changed") === "lead.status_changed" && h.changed_at)
        .sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at))[0]
    : null;
  const statusAgeDays = ageInDays(latestStatusChange?.changed_at || displayLead.createdAt || displayLead.created_at);

  useEffect(() => {
    if (!fetchHistory) return;
    let cancelled = false;
    setHistory(null);
    setHistoryError("");
    fetchHistory(lead.id)
      .then((res) => { if (!cancelled) setHistory(res.history || []); })
      .catch((err) => { if (!cancelled) setHistoryError(err.message || "Couldn't load status history."); });
    return () => { cancelled = true; };
  }, [lead.id, lead.status, fetchHistory, historyRefresh]);


  const sendLeadMention = async () => {
    if (mentionSending || (!isAdmin && !employeeRepliesEnabled)) return;
    const body = mentionText.trim();
    if (!body) return;
    setMentionSending(true); setMentionError(""); setMentionSaved("");
    try {
      if (isAdmin) {
        await api.adminSendLeadMention(lead.id, body);
        setMentionSaved(`Sent to ${lead.salesmanName || "salesman"}.`);
        setMentionText(lead.salesmanName ? `@${lead.salesmanName} ` : "");
      } else {
        const latestAdminMessage = [...(history || [])]
          .filter(h => h.action === "lead.admin_mention" && h.message_id)
          .sort((a,b) => new Date(b.changed_at) - new Date(a.changed_at))[0];
        if (!latestAdminMessage) throw new Error("Admin needs to send the first message for this lead.");
        await api.salesmanReplyMessage(latestAdminMessage.message_id, body);
        setMentionSaved("Reply sent.");
        setMentionText("");
      }
      setHistoryRefresh(v => v + 1);
    } catch (err) { setMentionError(err.message || "Couldn't send message."); }
    finally { setMentionSending(false); }
  };

  const deleteLeadConversationMessage = async (messageId) => {
    if (!isAdmin || !messageId || deletingMessageId) return;
    if (!window.confirm("Delete this message?")) return;
    setDeletingMessageId(messageId);
    try {
      await api.adminDeleteMessage(messageId);
      setHistoryRefresh(v => v + 1);
    } catch (err) {
      setMentionError(err.message || "Couldn't delete message.");
    } finally {
      setDeletingMessageId(null);
    }
  };

  const saveEdit = async () => {
    const businessName = form.business.trim();
    if (!businessName) return;
    if (isAdmin && lead.status === "won" && !form.wonDate) {
      setEditError("Won Date is required for a Won deal.");
      return;
    }
    setSaving(true);
    setEditError("");
    const payload = {
      businessName,
      subLocation: form.subLocation, posName: form.posName,
      renewalMonth: form.renewalMonth, renewalDate: form.renewalDate || null,
      contactName: form.owner, phone: form.phone, notes: form.notes,
      dealValue: form.dealValue ? Number(form.dealValue) : null,
      nextFollowUpDate: form.nextFollowUpDate || null,
    };
    if (isAdmin && lead.status === "won") payload.wonDate = form.wonDate;
    try {
      const result = await onUpdate(lead.id, payload);
      const returnedWonDate = result?.lead?.won_date || payload.wonDate;
      setSavedOverrides((prev) => ({
        ...prev,
        business: payload.businessName,
        subLocation: payload.subLocation, posName: payload.posName,
        renewalMonth: payload.renewalMonth, renewalDate: payload.renewalDate || "",
        owner: payload.contactName, phone: payload.phone, notes: payload.notes,
        dealValue: payload.dealValue,
        nextFollowUpDate: payload.nextFollowUpDate || "",
        ...(returnedWonDate ? { wonDate: returnedWonDate } : {}),
      }));
      if (payload.wonDate) {
        setForm((prev) => ({ ...prev, wonDate: returnedWonDate || payload.wonDate }));
        setHistoryRefresh((v) => v + 1);
      }
      setEditing(false);
    } catch (err) {
      setEditError(err?.message || "Couldn't save changes.");
    } finally {
      setSaving(false);
    }
  };

  const followUpDate = displayLead.nextFollowUpDate ? new Date(displayLead.nextFollowUpDate) : null;
  const followUpDay = followUpDate && !Number.isNaN(followUpDate.getTime())
    ? new Date(followUpDate.getFullYear(), followUpDate.getMonth(), followUpDate.getDate())
    : null;
  const todayDay = new Date();
  todayDay.setHours(0, 0, 0, 0);
  const followUpDaysDiff = followUpDay ? Math.round((followUpDay - todayDay) / 86400000) : null;
  const followUpLabel = followUpDaysDiff == null ? "" : followUpDaysDiff < 0
    ? `${Math.abs(followUpDaysDiff)} day${Math.abs(followUpDaysDiff) === 1 ? "" : "s"} overdue`
    : followUpDaysDiff === 0 ? "Due today"
    : `In ${followUpDaysDiff} day${followUpDaysDiff === 1 ? "" : "s"}`;
  const formattedFollowUp = followUpDate && !Number.isNaN(followUpDate.getTime())
    ? followUpDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "";

  const markFollowUpDone = async () => {
    if (!onUpdate || followUpSaving) return;
    setFollowUpSaving(true);
    try {
      await onUpdate(lead.id, { nextFollowUpDate: null });
      setSavedOverrides((prev) => ({ ...prev, nextFollowUpDate: "" }));
      setForm((prev) => ({ ...prev, nextFollowUpDate: "" }));
    } finally {
      setFollowUpSaving(false);
    }
  };

  const saveReschedule = async () => {
    if (!onUpdate || !rescheduleDate || followUpSaving) return;
    setFollowUpSaving(true);
    try {
      await onUpdate(lead.id, { nextFollowUpDate: rescheduleDate });
      setSavedOverrides((prev) => ({ ...prev, nextFollowUpDate: rescheduleDate }));
      setForm((prev) => ({ ...prev, nextFollowUpDate: rescheduleDate }));
      setShowReschedule(false);
      setRescheduleDate("");
    } finally {
      setFollowUpSaving(false);
    }
  };

  const applyFollowUp = async (iso) => {
    if (!onUpdate || !iso || followUpSaving) return;
    setFollowUpSaving(true);
    try {
      await onUpdate(lead.id, { nextFollowUpDate: iso });
      setSavedOverrides((prev) => ({ ...prev, nextFollowUpDate: iso }));
      setForm((prev) => ({ ...prev, nextFollowUpDate: iso }));
      setShowReschedule(false);
    } finally {
      setFollowUpSaving(false);
    }
  };

  const changeStatus = (next) => {
    if (!onStatusChange || next === lead.status) return;
    const previous = lead.status;
    onStatusChange(lead.id, next);
    setStatusExpanded(false);
    setStatusToast({ label: STATUS_LABEL[next] || next, previous });
    clearTimeout(statusToastTimer.current);
    statusToastTimer.current = setTimeout(() => setStatusToast(null), 5000);
  };

  const undoStatus = () => {
    if (!statusToast) return;
    clearTimeout(statusToastTimer.current);
    onStatusChange(lead.id, statusToast.previous);
    setStatusToast(null);
  };

  useEffect(() => () => clearTimeout(statusToastTimer.current), []);

  const detailRows = [
    ["Business Name", displayLead.business],
    ["Sub Location", displayLead.subLocation],
    ["POS Name", displayLead.posName],
    ["Renewal Month", displayLead.renewalMonth],
    ["Renewal Date", displayLead.renewalDate],
    ["Contact Name", displayLead.owner],
    ["Contact Number", displayLead.phone],
    ["Expected Deal Value", displayLead.dealValue != null ? `₹${displayLead.dealValue.toLocaleString("en-IN")}` : null],
  ].filter(([, v]) => v);

  let briefNext = null;
  if (history !== null || historyError || !fetchHistory) {
    try { briefNext = buildLeadBrief(displayLead, history || []).nextAction || null; } catch { briefNext = null; }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(28,36,48,0.35)", display: "flex", justifyContent: "flex-end", zIndex: 2000 }} onClick={onClose}>
      <div className="ft-lead-detail-panel" style={{ width: "min(620px, 100vw)", maxWidth: "100vw", background: "#F8FAF9", height: "100%", padding: "18px clamp(14px, 4vw, 24px) 28px", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: T.route, fontSize: 13, fontWeight: 700, padding: 0 }}>← Back to Leads</button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {onUpdate && !editing && (
              <button onClick={() => setEditing(true)} style={{ border: `1px solid ${T.line}`, background: "#fff", borderRadius: 10, cursor: "pointer", color: T.ink, padding: "8px 12px", fontSize: 12.5, fontWeight: 700 }}>✎ Edit</button>
            )}
          </div>
        </div>

        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ ...leadAvatarStyle(displayLead.business), width: 58, height: 58, minWidth: 58, fontSize: 18 }}>{leadInitials(displayLead.business)}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20 }}>{displayLead.business}</div>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: T.route, background: "#EAF5F0", padding: "5px 9px", borderRadius: 999 }}>{STATUS_LABEL[lead.status]}</span>
              </div>

            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.line}` }}>
            <div style={{ fontSize: 11.5, color: T.inkSoft, fontWeight: 650, minWidth: 0, whiteSpace: "nowrap" }}>
              {dealAgeDays != null ? <span style={{ color: T.ink, fontWeight: 750 }}>{dealAgeDays} day{dealAgeDays === 1 ? "" : "s"} old</span> : <span style={{ color: T.inkSoft }}>Age —</span>}
              <span style={{ margin: "0 6px", color: T.line }}>·</span>
              {statusAgeDays != null ? <span style={{ color: statusAgeDays >= 14 ? T.danger : statusAgeDays >= 7 ? "#B7791F" : T.inkSoft, fontWeight: statusAgeDays >= 7 ? 750 : 650 }}>{statusAgeDays >= 7 ? "⚠ " : ""}{statusAgeDays} day{statusAgeDays === 1 ? "" : "s"} in stage</span> : <span style={{ color: T.inkSoft }}>Stage age —</span>}
            </div>
            {displayLead.phone && (
              <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
                <a aria-label="Call lead" title="Call" href={`tel:${displayLead.phone}`} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.line}`, background: "#fff", color: T.route, textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><PhoneIcon size={14} /></a>
                <a aria-label="WhatsApp lead" title="WhatsApp" href={whatsappLink(displayLead.phone)} target="_blank" rel="noreferrer" style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.line}`, background: "#fff", color: T.route, textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><WhatsAppIcon size={14} /></a>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {lead.hasLocation ? <VerificationStamp status={lead.verification} /> : <NoLocationBadge />}
          <SyncBadge syncStatus={lead.syncStatus} />
          <TasksEntry lead={lead} compact />
          <button
            onClick={() => setShowBrief(true)}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999, border: "none", cursor: "pointer", background: "#F0EBFB", color: "#6B46C1", fontSize: 11.5, fontWeight: 700 }}
          >
            <Sparkles size={13} /> Brief
          </button>
          <button
            onClick={() => setShowLeadConversation(true)}
            aria-label={`Open chat for ${displayLead.business}`}
            title="Open lead chat"
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999, border: "none", cursor: "pointer", background: "#EAF5F0", color: T.route, fontSize: 11.5, fontWeight: 700 }}
          >
            <MessageSquare size={13} /> Chat
          </button>
        </div>

        {showBrief && <LeadBriefPopup key={lead.id} lead={displayLead} buildBrief={buildLeadBrief} onClose={() => setShowBrief(false)} />}

        {onStatusChange && !editing && (
          <div style={{ marginTop: 12, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, padding: 13 }}>
            <div role="button" tabIndex={0} aria-expanded={statusExpanded} onClick={() => setStatusExpanded((v) => !v)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setStatusExpanded((v) => !v); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, cursor: "pointer" }}>
              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", color: T.inkSoft, fontWeight: 600, letterSpacing: 0.3 }}>Update status</div>
                <div style={{ marginTop: 5, fontSize: 13.5, fontWeight: 800, color: T.ink }}>{STATUS_LABEL[lead.status]}</div>
              </div>
              <span aria-hidden="true" style={{ fontSize: 18, color: T.inkSoft }}>{statusExpanded ? "⌃" : "›"}</span>
            </div>
            {statusExpanded && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 11, paddingTop: 10, borderTop: `1px solid ${T.line}` }}>
                {STATUSES.map((s) => (
                  <button key={s} onClick={(e) => { e.stopPropagation(); changeStatus(s); }} style={{ fontSize: 11.5, padding: "5px 9px", borderRadius: 6, cursor: "pointer", border: `1px solid ${lead.status === s ? T.route : T.line}`, background: lead.status === s ? T.route : "#fff", color: lead.status === s ? "#fff" : T.ink, fontWeight: 600 }}>{STATUS_LABEL[s]}</button>
                ))}
              </div>
            )}
          </div>
        )}

                {!editing && (
          <div style={{ display: "flex", borderBottom: `1px solid ${T.line}`, marginTop: 16, background: "#fff", borderRadius: "12px 12px 0 0" }}>
            {["overview", "activity"].map((tab) => (
              <button key={tab} onClick={() => setDetailTab(tab)} style={{ flex: 1, padding: "11px 8px", border: "none", borderBottom: detailTab === tab ? `2px solid ${T.route}` : "2px solid transparent", background: "transparent", color: detailTab === tab ? T.route : T.inkSoft, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>{tab}</button>
            ))}
          </div>
        )}


        
        {editing ? (
          <div style={{ marginTop: 16 }}>
            <Field label="Business Name *"><input style={inputStyle} value={form.business} onChange={set("business")} placeholder="Business / Restaurant name" /></Field>
            <Field label="Sub Location"><input style={inputStyle} value={form.subLocation} onChange={set("subLocation")} /></Field>
            <Field label="POS Name"><input style={inputStyle} value={form.posName} onChange={set("posName")} /></Field>
            <Field label="Contact Name"><input style={inputStyle} value={form.owner} onChange={set("owner")} /></Field>
            <Field label="Contact Number"><input style={inputStyle} value={form.phone} onChange={set("phone")} /></Field>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}><Field label="Renewal Month">
                <select style={inputStyle} value={form.renewalMonth} onChange={set("renewalMonth")}>
                  <option value="">Select…</option>
                  {MONTH_NAMES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field></div>
              <div style={{ flex: 1 }}><Field label="Renewal Date"><input style={inputStyle} type="date" value={form.renewalDate} onChange={set("renewalDate")} /></Field></div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}><Field label="Expected Deal Value"><input style={inputStyle} type="number" min="0" value={form.dealValue} onChange={set("dealValue")} placeholder="₹ e.g. 45000" /></Field></div>
              <div style={{ flex: 1 }}><Field label="Next Follow-up Date"><input style={inputStyle} type="date" value={form.nextFollowUpDate} onChange={set("nextFollowUpDate")} /></Field></div>
            </div>
            {isAdmin && lead.status === "won" && (
              <Field label="Won Date"><input style={inputStyle} type="date" value={form.wonDate} onChange={set("wonDate")} /></Field>
            )}
            {editError && <div style={{ fontSize: 12.5, color: T.danger, background: T.dangerSoft, borderRadius: 10, padding: "8px 10px", marginBottom: 10 }}>{editError}</div>}
            <Field label="Comments"><textarea style={{ ...inputStyle, minHeight: 60 }} value={form.notes} onChange={set("notes")} /></Field>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setEditing(false)} style={{ flex: 1, padding: 10, borderRadius: 11, border: `1px solid ${T.line}`, background: "#fff", color: T.ink, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={saveEdit} disabled={saving || !form.business.trim() || (isAdmin && lead.status === "won" && !form.wonDate)} style={{ flex: 1, padding: 10, borderRadius: 11, border: "none", background: T.route, color: "#fff", fontWeight: 700, cursor: saving || !form.business.trim() || (isAdmin && lead.status === "won" && !form.wonDate) ? "not-allowed" : "pointer", opacity: saving || !form.business.trim() || (isAdmin && lead.status === "won" && !form.wonDate) ? .6 : 1 }}>{saving ? "Saving…" : "Save changes"}</button>
            </div>
          </div>
        ) : detailTab === "overview" ? (
          <>
            {formattedFollowUp && (
              <div style={{ marginTop: 12, background: followUpDaysDiff < 0 ? "#FFF1F1" : followUpDaysDiff === 0 ? "#FFF8E8" : "#F0F7FF", border: `1px solid ${followUpDaysDiff < 0 ? "#F6B8B8" : followUpDaysDiff === 0 ? "#F0D89A" : "#C9DDF7"}`, borderRadius: 14, padding: 14 }}>
                <div role="button" tabIndex={0} aria-expanded={followUpExpanded} onClick={() => setFollowUpExpanded((v) => !v)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setFollowUpExpanded((v) => !v); }} style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start", minWidth: 0 }}>
                    <div style={{ fontSize: 20, lineHeight: 1 }}>📅</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: followUpDaysDiff < 0 ? "#D92D20" : T.ink }}>Next Follow-up</div>
                      <div style={{ marginTop: 3, fontSize: 13, fontWeight: 600, color: followUpDaysDiff < 0 ? "#D92D20" : T.ink }}>{formattedFollowUp}{followUpLabel ? ` · ${followUpLabel}` : ""}</div>
                    </div>
                  </div>
                  <span aria-hidden="true" style={{ fontSize: 18, color: T.inkSoft }}>{followUpExpanded ? "⌃" : "›"}</span>
                </div>
                {followUpExpanded && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.line}` }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 9 }}>
                      <button disabled={followUpSaving} onClick={markFollowUpDone} style={{ minHeight: 30, padding: "0 9px", border: `1px solid ${T.route}`, borderRadius: 8, background: "#fff", color: T.route, fontSize: 11.5, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>{followUpSaving ? "Saving…" : "✓ Mark Done"}</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
                      {FOLLOWUP_QUICK.map(([label, days]) => (
                        <button key={label} disabled={followUpSaving} onClick={() => { const date = isoDaysFromToday(days); if (window.confirm(`Set next follow-up to ${label.toLowerCase()}?`)) applyFollowUp(date); }} style={{ minHeight: 36, padding: "0 11px", borderRadius: 8, border: `1px solid ${T.line}`, background: "#fff", color: T.ink, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{label}</button>
                      ))}
                      <label aria-label="Reschedule follow-up" title="Reschedule" style={{ minWidth: 40, minHeight: 36, padding: "0 10px", border: `1px solid ${T.line}`, borderRadius: 10, background: "#fff", color: T.ink, fontSize: 17, fontWeight: 700, cursor: followUpSaving ? "default" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", position: "relative", boxSizing: "border-box" }}>
                        📅
                        <input type="date" disabled={followUpSaving} value="" onChange={(e) => { if (e.target.value) applyFollowUp(e.target.value); }} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }} />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!formattedFollowUp && onUpdate && (
              <div style={{ marginTop: 12, background: T.warnSoft, border: "1px solid #F0D89A", borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: T.ink }}>Next Follow-up</div>
                <div style={{ marginTop: 3, fontSize: 12.5, color: T.inkSoft }}>Not set. Pick a quick date:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  {FOLLOWUP_QUICK.map(([label, days]) => (
                    <button key={label} disabled={followUpSaving} onClick={() => { const date = isoDaysFromToday(days); if (window.confirm(`Set next follow-up to ${label.toLowerCase()}?`)) applyFollowUp(date); }} style={{ minHeight: 40, padding: "0 13px", borderRadius: 999, border: `1px solid ${T.line}`, background: "#fff", color: T.ink, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{label}</button>
                  ))}
                  <label aria-label="Schedule follow-up date" title="Choose date" style={{ minWidth: 40, minHeight: 36, padding: "0 10px", border: `1px solid ${T.line}`, borderRadius: 8, background: "#fff", color: T.ink, fontSize: 17, fontWeight: 700, cursor: followUpSaving ? "default" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", position: "relative", boxSizing: "border-box" }}>
                    📅
                    <input type="date" disabled={followUpSaving} value="" onChange={(e) => { if (e.target.value) applyFollowUp(e.target.value); }} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }} />
                  </label>
                </div>
              </div>
            )}
            {displayLead.notes && (
              <div style={{ marginTop: 12, background: "#EAF5F0", border: "1px solid #CFE6DC", borderRadius: 12, padding: 13 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: T.route, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Comments</div>
                <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.55, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{displayLead.notes}</div>
              </div>
            )}

            <div style={{ marginTop: 12, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 8, color: T.ink }}>Lead Information</div>
              {detailRows.map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", fontSize: 13 }}>
                  <span style={{ color: T.inkSoft }}>{label}</span>
                  {label === "Contact Number" ? (
                    <a href={`tel:${value}`} style={{ fontWeight: 700, textAlign: "right", color: T.route, textDecoration: "none" }}>
                      {value}
                    </a>
                  ) : (
                    <span style={{ fontWeight: 600, textAlign: "right" }}>{value}</span>
                  )}
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", fontSize: 13 }}>
                <span style={{ color: T.inkSoft }}>Created</span>
                <span style={{ fontWeight: 600 }}>{lead.createdAt.toLocaleString("en-IN")}</span>
              </div>
            </div>

            {lead.hasLocation ? (
              <div style={{ marginTop: 12, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, fontSize: 12.5 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 4 }}>Location</div>
                    <div style={{ color: T.inkSoft }}>{displayLead.subLocation || `${lead.lat.toFixed(5)}, ${lead.lng.toFixed(5)}`}</div>
                  </div>
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${lead.lat},${lead.lng}`} target="_blank" rel="noreferrer" style={{ border: `1px solid ${T.route}`, borderRadius: 9, padding: "7px 10px", color: T.route, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>Directions</a>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 12, fontSize: 12, color: T.inkSoft, background: T.paperDeep, borderRadius: 11, padding: "8px 10px" }}>
                No location captured for this lead.
              </div>
            )}

          </>
        ) : null}

        {fetchHistory && !editing && detailTab === "activity" && (
          <div style={{ marginTop: 14 }}>
            {isAdmin && !(history || []).some(h => h.action === "lead.admin_mention" || h.action === "lead.employee_reply") && (
              <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: T.ink, marginBottom: 4 }}>Send instruction</div>
                <div style={{ fontSize: 11.5, color: T.inkSoft, marginBottom: 9 }}>This note stays in the lead activity and is also sent to {lead.salesmanName || "the assigned salesman"} in Messages.</div>
                <textarea value={mentionText} onChange={e => { setMentionText(e.target.value); setMentionSaved(""); }} maxLength={2000} rows={3} placeholder={lead.salesmanName ? `@${lead.salesmanName} Type an instruction…` : "Type an instruction…"} style={{ width: "100%", boxSizing: "border-box", resize: "vertical", border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 11px", font: "inherit", fontSize: 13, color: T.ink, outline: "none" }} />
                {mentionError && <div style={{ color: T.danger, fontSize: 11.5, marginTop: 6 }}>{mentionError}</div>}
                {mentionSaved && <div style={{ color: T.route, fontSize: 11.5, marginTop: 6 }}>{mentionSaved}</div>}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 9 }}>
                  <button disabled={mentionSending || !mentionText.trim()} onClick={sendLeadMention} style={{ border: "none", borderRadius: 9, background: T.route, color: "#fff", padding: "8px 13px", fontSize: 12.5, fontWeight: 800, cursor: mentionSending ? "default" : "pointer", opacity: mentionSending ? .65 : 1 }}>{mentionSending ? "Sending…" : "Send instruction"}</button>
                </div>
              </div>
            )}
            {history === null && !historyError && (
              <div style={{ fontSize: 12.5, color: T.inkSoft, display: "flex", alignItems: "center", gap: 6, padding: "12px 2px" }}>
                <Loader2 size={13} className="spin" /> Loading activity…
              </div>
            )}
            {historyError && (
              <div style={{ fontSize: 12.5, color: T.danger, padding: "12px 2px" }}>{historyError}</div>
            )}
            {history && history.length === 0 && (
              <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, fontSize: 12.5, color: T.inkSoft }}>
                No status activity yet — current status is {STATUS_LABEL[lead.status]}.
              </div>
            )}
            {history && history.length > 0 && (() => {
              const now = new Date();
              const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
              const yesterday = new Date(now);
              yesterday.setDate(now.getDate() - 1);
              const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;

              const rawSorted = [...history].sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at));
              const conversationMessages = rawSorted
                .filter(h => h.action === "lead.admin_mention" || h.action === "lead.employee_reply")
                .sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at));
              const nonConversation = rawSorted.filter(h => h.action !== "lead.admin_mention" && h.action !== "lead.employee_reply");
              const sorted = conversationMessages.length
                ? [
                    ...nonConversation,
                    {
                      id: `lead-conversation-${lead.id}`,
                      action: "lead.conversation",
                      changed_at: conversationMessages[conversationMessages.length - 1].changed_at,
                      changed_by_name: conversationMessages[conversationMessages.length - 1].changed_by_name,
                      message_body: conversationMessages[conversationMessages.length - 1].message_body,
                      conversation_messages: conversationMessages,
                    },
                  ].sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at))
                : nonConversation;
              const groups = [];
              sorted.forEach((h) => {
                const d = new Date(h.changed_at);
                const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                let group = groups.find((g) => g.key === key);
                if (!group) {
                  const label = key === todayKey
                    ? "Today"
                    : key === yesterdayKey
                      ? "Yesterday"
                      : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
                  group = { key, label, items: [] };
                  groups.push(group);
                }
                group.items.push(h);
              });

              return (
                <div>
                  {groups.map((group, groupIndex) => (
                    <div key={group.key} style={{ marginTop: groupIndex === 0 ? 0 : 18 }}>
                      <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.55, color: T.inkSoft, fontWeight: 800, marginBottom: 10 }}>
                        {group.label}
                      </div>
                      <div style={{ position: "relative" }}>
                        {group.items.map((h, i) => (
                          <div key={h.id || `${group.key}-${i}`} style={{ display: "flex", gap: 12, minHeight: 58 }}>
                            <div style={{ width: 12, display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                              <div style={{ width: 9, height: 9, borderRadius: 99, background: T.route, marginTop: 5, boxShadow: "0 0 0 3px #EAF5F0", zIndex: 1 }} />
                              {i !== group.items.length - 1 && <div style={{ width: 1.5, flex: 1, background: T.line, marginTop: 4 }} />}
                            </div>
                            <div style={{ flex: 1, paddingBottom: i === group.items.length - 1 ? 2 : 14 }}>
                              {(() => {
                                const action = h.action || "lead.status_changed";
                                const oldValue = h.old_value ?? h.old_status;
                                const newValue = h.new_value ?? h.new_status;
                                const titles = {
                                  "lead.created": "Lead created",
                                  "lead.created_by_admin": "Lead created",
                                  "lead.status_changed": "Status changed",
                                  "lead.follow_up_scheduled": "Follow-up scheduled",
                                  "lead.follow_up_rescheduled": "Follow-up rescheduled",
                                  "lead.follow_up_done": "Follow-up completed",
                                  "lead.comment_updated": "Comment updated",
                                  "lead.won_date_changed": "Won Date changed",
                                  "lead.edited": "Lead information updated",
                                  "lead.admin_mention": "Admin instruction",
                                  "lead.employee_reply": "Employee reply",
                                  "lead.conversation": "Lead Conversation",
                                };
                                const fmtDate = (v) => {
                                  if (!v) return "";
                                  const d = new Date(`${String(v).slice(0,10)}T00:00:00`);
                                  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
                                };
                                let detail = null;
                                if (action === "lead.status_changed") {
                                  detail = <>{oldValue && <><span style={{ color: T.inkSoft }}>{STATUS_LABEL[oldValue] || oldValue}</span><span style={{ color: T.inkSoft }}> → </span></>}<span style={{ fontWeight: 700, color: T.route }}>{STATUS_LABEL[newValue] || newValue}</span></>;
                                } else if (action === "lead.follow_up_scheduled") {
                                  detail = <span style={{ fontWeight: 700, color: T.route }}>{fmtDate(newValue)}</span>;
                                } else if (action === "lead.follow_up_rescheduled") {
                                  detail = <><span style={{ color: T.inkSoft }}>{fmtDate(oldValue)}</span><span style={{ color: T.inkSoft }}> → </span><span style={{ fontWeight: 700, color: T.route }}>{fmtDate(newValue)}</span></>;
                                } else if (action === "lead.follow_up_done") {
                                  detail = <span style={{ color: T.inkSoft }}>{oldValue ? `Completed follow-up for ${fmtDate(oldValue)}` : "Marked done"}</span>;
                                } else if (action === "lead.conversation") {
                                  const msgs = h.conversation_messages || [];
                                  const latest = msgs[msgs.length - 1];
                                  detail = <button onClick={() => setShowLeadConversation(true)} style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", padding: 0, cursor: "pointer", color: T.ink }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                                      <span style={{ color: T.inkSoft }}>{latest?.changed_by_name || "User"} · “{String(latest?.message_body || "").slice(0, 95)}{String(latest?.message_body || "").length > 95 ? "…" : ""}”</span>
                                      <span style={{ flexShrink: 0, fontWeight: 800, color: T.route }}>{msgs.length} ›</span>
                                    </div>
                                  </button>;
                                } else if (action === "lead.admin_mention") {
                                  detail = <div><span style={{ fontWeight: 800, color: T.route }}>{h.recipient_name ? `@${h.recipient_name}` : "Salesman"}</span><div style={{ marginTop: 4, color: T.ink, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{h.message_body || "Instruction sent"}</div></div>;
                                } else if (action === "lead.employee_reply") {
                                  detail = <div style={{ color: T.ink, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{h.message_body || "Reply sent"}</div>;
                                } else if (action === "lead.won_date_changed") {
                            detail = <><span style={{ color: T.inkSoft }}>{fmtDate(oldValue)}</span><span style={{ color: T.inkSoft }}> → </span><span style={{ fontWeight: 700, color: T.route }}>{fmtDate(newValue)}</span></>;
                          } else if (action === "lead.comment_updated") {
                                  const text = String(newValue || "").trim();
                                  detail = text ? <span style={{ color: T.inkSoft }}>“{text.length > 90 ? `${text.slice(0, 90)}…` : text}”</span> : <span style={{ color: T.inkSoft }}>Comment cleared</span>;
                                } else if (action === "lead.edited" && h.changes) {
                                  const names = { businessName:"Business Name", subLocation:"Sub Location", posName:"POS Name", renewalMonth:"Renewal Month", renewalDate:"Renewal Date", contactName:"Contact Name", phone:"Contact Number", dealValue:"Deal Value" };
                                  const fields = Object.keys(h.changes).map((k) => names[k] || k);
                                  detail = <span style={{ color: T.inkSoft }}>{fields.length ? fields.join(", ") : "Lead details updated"}</span>;
                                }
                                return <>
                                  <div style={{ fontSize: 13, fontWeight: 750, color: T.ink }}>{titles[action] || "Lead updated"}</div>
                                  {detail && <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 3, fontSize: 13 }}>{detail}</div>}
                                </>;
                              })()}
                              <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 4 }}>
                                {h.changed_by_name || "User"} · {new Date(h.changed_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {showLeadConversation && (() => {
          const messages = (history || [])
            .filter(h => h.action === "lead.admin_mention" || h.action === "lead.employee_reply")
            .sort((a,b) => new Date(a.changed_at) - new Date(b.changed_at));
          return (
            <div style={{ position: "fixed", inset: 0, zIndex: 2300, background: "rgba(28,36,48,.28)", display: "flex", justifyContent: "flex-end" }} onClick={() => setShowLeadConversation(false)}>
              <div style={{ width: "min(500px,100vw)", height: "100%", background: "#F8FAF9", display: "flex", flexDirection: "column", boxShadow: "-12px 0 30px rgba(0,0,0,.12)" }} onClick={e => e.stopPropagation()}>
                <div style={{ padding: "16px 16px 12px", background: "#fff", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div><div style={{ fontWeight: 850, fontSize: 16 }}>{displayLead.business}</div><div style={{ fontSize: 11.5, color: T.inkSoft }}>Conversation with {lead.salesmanName || "salesman"}</div></div>
                  <button onClick={() => setShowLeadConversation(false)} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 6 }}><X size={19}/></button>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                  {messages.map(m => {
                    const adminMessage = m.action === "lead.admin_mention";
                    return <div key={m.message_id || m.id} style={{ display: "flex", justifyContent: adminMessage ? "flex-start" : "flex-end", marginBottom: 14 }}>
                      <div style={{ maxWidth: "82%" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: adminMessage ? "flex-start" : "flex-end", gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: 10.5, fontWeight: 800, color: T.inkSoft }}>{adminMessage ? "Admin" : (m.changed_by_name || lead.salesmanName || "Employee")}</span>
                          {isAdmin && m.message_id && <button title="Delete message" disabled={deletingMessageId === m.message_id} onClick={() => deleteLeadConversationMessage(m.message_id)} style={{ border: "none", background: "transparent", color: T.danger, padding: 2, cursor: "pointer", opacity: deletingMessageId === m.message_id ? .45 : .8 }}><Trash2 size={13}/></button>}
                        </div>
                        <div style={{ background: adminMessage ? "#fff" : T.paperDeep, border: `1px solid ${T.line}`, borderRadius: 12, padding: "9px 11px", fontSize: 13, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.message_body}</div>
                        <div style={{ marginTop: 3, fontSize: 10.5, color: T.inkSoft, textAlign: adminMessage ? "left" : "right" }}>{new Date(m.changed_at).toLocaleTimeString("en-IN",{hour:"numeric",minute:"2-digit"})}</div>
                      </div>
                    </div>;
                  })}
                </div>
                {(isAdmin || employeeRepliesEnabled) && <div style={{ padding: 12, background: "#fff", borderTop: `1px solid ${T.line}` }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <textarea value={mentionText} onChange={e => { setMentionText(e.target.value); setMentionError(""); }} rows={2} maxLength={2000} placeholder={isAdmin ? "Write a message…" : "Reply to Admin…"} style={{ flex: 1, resize: "none", border: `1px solid ${T.line}`, borderRadius: 10, padding: "9px 10px", font: "inherit", fontSize: 13 }} />
                    <button disabled={mentionSending || !mentionText.trim()} onClick={sendLeadMention} style={{ border: "none", borderRadius: 9, background: T.route, color: "#fff", padding: "10px 13px", fontWeight: 800, cursor: "pointer", opacity: mentionSending || !mentionText.trim() ? .55 : 1 }}>{mentionSending ? "…" : (isAdmin ? "Send" : "Reply")}</button>
                  </div>
                  {mentionError && <div style={{ color: T.danger, fontSize: 11.5, marginTop: 5 }}>{mentionError}</div>}
                </div>}
              </div>
            </div>
          );
        })()}

        {statusToast && (
          <div role="status" style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: "max(18px, env(safe-area-inset-bottom))", width: "min(420px, calc(100vw - 24px))", zIndex: 2200, background: T.ink, color: "#fff", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
            <span>Status changed to {statusToast.label}</span>
            <button onClick={undoStatus} style={{ minHeight: 36, border: "none", background: "none", color: "#fff", fontWeight: 800, textDecoration: "underline", cursor: "pointer" }}>Undo</button>
          </div>
        )}

        {onDelete && !editing && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.line}` }}>
            {confirmingDelete ? (
              <div style={{ background: T.dangerSoft, borderRadius: 11, padding: 12 }}>
                <div style={{ fontSize: 12.5, color: T.danger, marginBottom: 10 }}>
                  Delete this lead permanently? This can't be undone.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setConfirmingDelete(false)} style={{ flex: 1, padding: 9, borderRadius: 7, border: `1px solid ${T.line}`, background: "#fff", color: T.ink, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                  <button onClick={() => { onDelete(lead.id); onClose(); }} style={{ flex: 1, padding: 9, borderRadius: 7, border: "none", background: T.danger, color: "#fff", fontWeight: 700, cursor: "pointer" }}>Delete permanently</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmingDelete(true)} style={{ fontSize: 12.5, fontWeight: 700, color: T.danger, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                Delete lead
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}



// ---------------------------------------------------------------------------
// SALESMAN — real day start/end, a throttled real-GPS ping loop while the
// day is active, and an offline lead queue that actually retries against
// the server (backend dedupes on client_uuid, so retries are always safe).
// ---------------------------------------------------------------------------
function SalesmanApp({ session, online, page, notificationLead }) {
  const [loadError, setLoadError] = useState("");
  const [dayStarted, setDayStartedState] = useState(getDayStarted(session.id));
  const [gpsStatus, setGpsStatus] = useState("idle"); // idle | tracking | denied | unavailable

  useEffect(() => {
    let live=true;
    const sync=()=>api.closingStatus().then(v=>{if(live){setDayStartedState(v.active);setDayStartedFlag(session.id,v.active);}}).catch(()=>{});
    sync();window.addEventListener('focus',sync);
    return()=>{live=false;window.removeEventListener('focus',sync);};
  },[session.id]);

  const {
    messages,
    employeeRepliesEnabled,
    setEmployeeRepliesEnabled,
    markMessageRead,
    deleteMessage,
    replyToMessage,
  } = useSalesmanMessages();

  const {
    continuousTracking,
    allowLeadWithoutStartDay,
    attendanceLocationPolicy,
    dailyTarget,
    monthlyTarget,
  } = useSalesmanSettings({ setEmployeeRepliesEnabled });

  const getBatteryPct = useCallback(async () => {
    try {
      if (navigator.getBattery) {
        const b = await navigator.getBattery();
        return Math.round(b.level * 100);
      }
    } catch { /* not supported (iOS Safari etc.) */ }
    return null;
  }, []);

  useAttendanceGps({
    dayStarted,
    continuousTracking,
    attendanceLocationPolicy,
    setGpsStatus,
    getBatteryPct,
  });

  const {
    leads,
    leadSummary,
    loading,
    loadingMore,
    queuedCount,
    totalLeadCount,
    hasMoreLeads,
    loadMoreLeads,
    handleAddLead,
    handleUpdateLeadStatus,
    handleUpdateLeadDetails,
  } = useSalesmanLeads({
    online,
    session,
    setLoadError,
    makeQueuedLead: (payload) => adHocLeadFromPayload(payload, session),
  });

  const [showClosing,setShowClosing]=useState(false);
  const [justToggled, setJustToggled] = useState(false); // brief "Started"/"Ended" confirmation flash

  const { togglingDay, handleToggleDay } = useAttendanceDay({
    dayStarted,
    attendanceLocationPolicy,
    sessionId: session.id,
    setShowClosing,
    setDayStartedState,
    setJustToggled,
    setLoadError,
  });

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 60, color: T.inkSoft, fontSize: 13 }}>
        <Loader2 size={16} className="spin" /> Loading your leads…
      </div>
    );
  }

  return (
    <>
    {showClosing && <DayClosingForm onClose={()=>setShowClosing(false)} onEnd={handleToggleDay}/>}
    <SalesmanView
      notificationLead={notificationLead}
      session={session}
      leads={leads}
      leadSummary={leadSummary}
      hasMoreLeads={hasMoreLeads}
      loadMoreLeads={loadMoreLeads}
      loadingMoreLeads={loadingMore}
      totalLeadCount={totalLeadCount}
      dayStarted={dayStarted}
      allowLeadWithoutStartDay={allowLeadWithoutStartDay}
      onToggleDay={()=>handleToggleDay()}
      togglingDay={togglingDay}
      justToggledDay={justToggled}
      onAddLead={handleAddLead}
      onUpdateLeadStatus={handleUpdateLeadStatus}
      onUpdateLeadDetails={handleUpdateLeadDetails}
      online={online}
      gpsStatus={gpsStatus}
      queuedCount={queuedCount}
      loadError={loadError}
      messages={messages}
      onMarkMessageRead={markMessageRead}
      onDeleteMessage={deleteMessage}
      onReplyMessage={replyToMessage}
      employeeRepliesEnabled={employeeRepliesEnabled}
      dailyTarget={dailyTarget}
      monthlyTarget={monthlyTarget}
      page={page}
      shared={{
        T, fmtMoney, isToday, isThisMonth, isWithinDays, isUpcomingRenewalMonth,
        SalesmanReportsPage, StatCard, MessagesSection, MyLeadsModal, AddLeadModal, LeadDetailDrawer, VerificationStamp, NoLocationBadge,
      }}
    />
    </>
  );
}

function adHocLeadFromPayload(payload, session) {
  const hasLocation = payload.lat != null && payload.lng != null;
  return {
    id: payload.clientUuid,
    clientUuid: payload.clientUuid,
    salesmanId: session.id,
    salesmanName: session.fullName,
    business: payload.businessName,
    subLocation: payload.subLocation || "",
    posName: payload.posName || "",
    renewalMonth: payload.renewalMonth || "",
    renewalDate: payload.renewalDate || "",
    owner: payload.contactName,
    phone: payload.phone,
    category: payload.category,
    status: payload.status || "new",
    hasLocation,
    lat: hasLocation ? payload.lat : null,
    lng: hasLocation ? payload.lng : null,
    accuracy: payload.accuracyM,
    verification: hasLocation ? (payload.accuracyM > 50 ? "poor_accuracy" : "verified") : null,
    createdAt: new Date(),
    notes: payload.notes || "",
  };
}


const DEFAULT_LEAD_SETTINGS = {
  requireBusinessName: true, requireSubLocation: true, requirePosName: true,
  requireContactName: true, requireContactNumber: true, requireStatus: true, requireComments: false,
  requireDealValue: false, requireFollowUpDate: false,
  duplicateProtectionEnabled: true, duplicateCheckPhone: true, duplicateCheckBusinessLocation: true, allowDuplicateOverride: false,
};
const DEFAULT_LOCATION_SETTINGS = { gpsLocation: true, locationMandatoryForNewLead: true, continuousGpsTracking: true };

// Tasks/messages sent by admin, shown right below the lead buttons on the
// salesman's own dashboard. Unread ones are visually distinct; tapping one
// marks it read.
function MessagesSection({ messages, onMarkRead, onDelete, onReply, employeeRepliesEnabled = true, onOpenLead }) {
  const unreadCount = messages.filter((m) => !m.read_at).length;
  // Lead-linked messages are conversations: one row per lead, while normal messages stay individual.
  const displayMessages = (() => {
    const leadThreads = new Map();
    const rows = [];
    messages.forEach((m) => {
      if (!m.lead_id) {
        rows.push({ ...m, _rowKey: `message:${m.id}`, _threadMessages: [m], _unreadCount: m.read_at ? 0 : 1 });
        return;
      }
      const key = String(m.lead_id);
      const existing = leadThreads.get(key);
      if (!existing) {
        const thread = { ...m, _rowKey: `lead:${key}`, _threadMessages: [m], _unreadCount: m.read_at ? 0 : 1 };
        leadThreads.set(key, thread);
        rows.push(thread);
      } else {
        existing._threadMessages.push(m);
        if (!m.read_at) existing._unreadCount += 1;
        if (new Date(m.created_at).getTime() > new Date(existing.created_at).getTime()) {
          const keep = { _rowKey: existing._rowKey, _threadMessages: existing._threadMessages, _unreadCount: existing._unreadCount };
          Object.assign(existing, m, keep);
        }
      }
    });
    return rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  })();
  const markThreadRead = (m) => {
    (m._threadMessages || [m]).filter((item) => !item.read_at).forEach((item) => onMarkRead(item.id));
  };
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyError, setReplyError] = useState("");
  const sendReply = async () => {
    if (!replyingTo || !replyText.trim() || replyBusy) return;
    setReplyBusy(true); setReplyError("");
    try { await onReply(replyingTo.id, replyText.trim()); setReplyingTo(null); setReplyText(""); }
    catch (e) { setReplyError(e.message || "Could not send reply."); }
    finally { setReplyBusy(false); }
  };

  return (
    <div className="ft-card" style={{ marginTop: 16, background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: displayMessages.length ? 10 : 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5, display: "flex", alignItems: "center", gap: 7 }}>
          <MessageSquare size={15} /> Messages
        </div>
        {unreadCount > 0 && (
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", background: T.danger, borderRadius: 999, padding: "2px 8px" }}>{unreadCount} new</span>
        )}
      </div>
      {displayMessages.length === 0 ? (
        <div style={{ fontSize: 12.5, color: T.inkSoft }}>No messages from admin yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {displayMessages.slice(0, 20).map((m) => (
            <div
              key={m._rowKey || m.id}
              style={{
                padding: "10px 12px", borderRadius: 11,
                background: m._unreadCount > 0 ? T.warnSoft : "#fff",
                border: `1px solid ${m._unreadCount > 0 ? "transparent" : T.line}`,
              }}
            >
              {m.lead_id && <div style={{ fontSize: 10.5, fontWeight: 800, color: T.route, textTransform: "uppercase", letterSpacing: .4, marginBottom: 4, display:"flex", justifyContent:"space-between", gap:8 }}><span>Lead conversation{m.business_name ? ` · ${m.business_name}` : ""}</span>{m._threadMessages?.length > 1 && <span style={{color:T.inkSoft,textTransform:"none",letterSpacing:0}}>{m._threadMessages.length} messages</span>}</div>}
              <div onClick={() => m._unreadCount > 0 && markThreadRead(m)} style={{ fontSize: 13, color: T.ink, whiteSpace: "pre-wrap", cursor: m._unreadCount > 0 ? "pointer" : "default" }}>{m.body}</div>
              {m.lead_id && onOpenLead && <button onClick={() => { markThreadRead(m); onOpenLead(m.lead_id); }} style={{ marginTop: 8, border: `1px solid ${T.route}`, background: "#fff", color: T.route, borderRadius: 8, padding: "6px 10px", fontSize: 11.5, fontWeight: 800, cursor: "pointer" }}>Open Lead →</button>}
              {m.lead_id && employeeRepliesEnabled && onReply && <button onClick={() => { markThreadRead(m); setReplyingTo(m); setReplyText(""); setReplyError(""); }} style={{ marginTop: 8, marginLeft: 7, border: `1px solid ${T.line}`, background: T.paperDeep, color: T.ink, borderRadius: 8, padding: "6px 10px", fontSize: 11.5, fontWeight: 800, cursor: "pointer" }}>Reply</button>}
              {m.lead_id && !employeeRepliesEnabled && <div style={{ marginTop: 7, fontSize: 10.5, color: T.inkSoft }}>Replies disabled by Admin</div>}
              {replyingTo?.id === m.id && <div style={{ marginTop: 9, paddingTop: 9, borderTop: `1px solid ${T.line}` }}>
                <textarea autoFocus rows={3} maxLength={2000} value={replyText} onChange={e=>setReplyText(e.target.value)} placeholder="Reply to Admin…" style={{ width:"100%", boxSizing:"border-box", resize:"vertical", border:`1px solid ${T.line}`, borderRadius:9, padding:"8px 9px", font:"inherit", fontSize:12.5, outline:"none" }} />
                {replyError && <div style={{fontSize:11,color:T.danger,marginTop:4}}>{replyError}</div>}
                <div style={{display:"flex",justifyContent:"flex-end",gap:7,marginTop:7}}><button disabled={replyBusy} onClick={()=>{setReplyingTo(null);setReplyText("");setReplyError("");}} style={{border:`1px solid ${T.line}`,background:"#fff",borderRadius:8,padding:"6px 9px",fontSize:11.5}}>Cancel</button><button disabled={replyBusy||!replyText.trim()} onClick={sendReply} style={{border:"none",background:T.route,color:"#fff",borderRadius:8,padding:"6px 10px",fontSize:11.5,fontWeight:800,opacity:replyBusy?.65:1}}>{replyBusy?"Sending…":"Send Reply"}</button></div>
              </div>}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                <span style={{ fontSize: 10.5, color: T.inkSoft }}>{fmtTime(new Date(m.created_at))}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {m._unreadCount > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: T.warn }}>{m._unreadCount > 1 ? `${m._unreadCount} unread` : "Tap to mark read"}</span>}
                  {onDelete && !m.lead_id && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(m.id); }}
                      style={{ border: "none", background: "none", cursor: "pointer", color: T.inkSoft, padding: 0, display: "flex", alignItems: "center" }}
                      title="Delete message"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function AddLeadOverlay({ onClose, children }) {
  return (
    <div className="engage-add-lead-overlay" style={{ position:"fixed", inset:0, zIndex:2000, background:"rgba(28,36,48,0.42)", display:"flex", alignItems:"flex-end", justifyContent:"center" }} onMouseDown={(e)=>{ if(e.target===e.currentTarget) onClose(); }}>
      <section className="engage-mobile-add-lead-polish" role="dialog" aria-modal="true" aria-label="Add Lead" style={{ width:"100%", maxWidth:480, maxHeight:"88vh", overflowY:"auto", background:T.card, padding:18, boxSizing:"border-box" }} onMouseDown={(e)=>e.stopPropagation()}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:14 }}>
          <div style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:700, fontSize:18 }}>Add Lead</div>
          <button type="button" aria-label="Close Add Lead" onClick={onClose} style={{ border:"none", background:"transparent", cursor:"pointer", color:T.ink }}><X size={19}/></button>
        </div>
        {children}
      </section>
    </div>
  );
}

function AddLeadModal({ session, online, onClose, onSubmit, onSaved }) {
  const [form, setForm] = useState({
    business: "", subLocation: "", posName: "", renewalMonth: "", renewalDate: "",
    owner: "", phone: "", category: "", status: "cold", notes: "", dealValue: "", nextFollowUpDate: "",
  });
  const [leadSettings, setLeadSettings] = useState(DEFAULT_LEAD_SETTINGS);
  const [locationSettings, setLocationSettings] = useState(DEFAULT_LOCATION_SETTINGS);
  const [fieldOptions, setFieldOptions] = useState({ category: [], pos_name: [], sub_location: [] });
  const [gps, setGps] = useState({ state: "locating" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [duplicateResult, setDuplicateResult] = useState(null);
  const [contactPickerSupported] = useState(() => typeof navigator !== "undefined" && "contacts" in navigator && "ContactsManager" in window);

  const pickContact = async () => {
    try {
      const contacts = await navigator.contacts.select(["name", "tel"], { multiple: false });
      if (contacts.length > 0) {
        const c = contacts[0];
        const rawPhone = c.tel?.[0] || "";
        const digitsOnly = rawPhone.replace(/\D/g, "").slice(-10); // keep last 10 digits, strip +91 etc.
        setForm((f) => ({ ...f, phone: digitsOnly || rawPhone, owner: f.owner || c.name?.[0] || "" }));
      }
    } catch {
      /* user cancelled the picker, or it failed — no error needed, they can still type it in */
    }
  };

  useEffect(() => {
    api.salesmanGetSettings()
      .then((res) => {
        if (res.leadSettings) setLeadSettings(res.leadSettings);
        if (res.locationSettings) setLocationSettings(res.locationSettings);
        if (!res.locationSettings?.gpsLocation) {
          setGps({ state: "off" }); // GPS turned off entirely — don't even ask for it
        }
      })
      .catch(() => { /* keep defaults if settings can't be fetched */ });
    api.salesmanGetLeadOptions()
      .then((res) => {
        setFieldOptions(res.options || { category: [], pos_name: [] });
        if (res.options?.category?.length) setForm((f) => (f.category ? f : { ...f, category: res.options.category[0] }));
      })
      .catch(() => { /* dropdowns just show empty if this fails — not fatal */ });
  }, []);

  useEffect(() => {
    if (!online || leadSettings.duplicateProtectionEnabled === false) { setDuplicateResult(null); return; }
    if (!form.phone.trim() && !(form.business.trim() && form.subLocation.trim())) { setDuplicateResult(null); return; }
    const timer = setTimeout(() => {
      api.salesmanCheckDuplicateLead({ phone: form.phone, businessName: form.business, subLocation: form.subLocation })
        .then(setDuplicateResult).catch(() => setDuplicateResult(null));
    }, 450);
    return () => clearTimeout(timer);
  }, [online, form.phone, form.business, form.subLocation, leadSettings]);

  useEffect(() => {
    if (!locationSettings.gpsLocation) return; // respect Location Settings: GPS Location = OFF
    if (!navigator.geolocation) { setGps({ state: "unavailable" }); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ state: "ok", lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) }),
      () => setGps({ state: "denied" }),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [locationSettings.gpsLocation]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const locationRequired = locationSettings.gpsLocation && locationSettings.locationMandatoryForNewLead;
  const locationReady = !locationSettings.gpsLocation || gps.state === "ok" || (!locationRequired && gps.state !== "locating");

  const canSubmit =
    form.business.trim().length > 0 &&
    (!leadSettings.requireSubLocation || form.subLocation.trim().length > 0) &&
    (!leadSettings.requirePosName || form.posName.trim().length > 0) &&
    (!leadSettings.requireContactName || form.owner.trim().length > 0) &&
    (!leadSettings.requireContactNumber || form.phone.trim().length > 0) &&
    (!leadSettings.requireComments || form.notes.trim().length > 0) &&
    (!leadSettings.requireDealValue || form.dealValue.trim().length > 0) &&
    (!leadSettings.requireFollowUpDate || form.nextFollowUpDate.trim().length > 0) &&
    locationReady;

  const verification = gps.state === "ok" ? (gps.accuracy > 50 ? "poor_accuracy" : "verified") : null;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    const hasGps = gps.state === "ok";
    const payload = {
      clientUuid: uuid(),
      businessName: form.business,
      subLocation: form.subLocation || null,
      posName: form.posName || null,
      renewalMonth: form.renewalMonth || null,
      renewalDate: form.renewalDate || null,
      contactName: form.owner,
      phone: form.phone,
      category: form.category,
      status: form.status,
      notes: form.notes,
      dealValue: form.dealValue ? Number(form.dealValue) : null,
      nextFollowUpDate: form.nextFollowUpDate || null,
      lat: hasGps ? gps.lat : null,
      lng: hasGps ? gps.lng : null,
      accuracyM: hasGps ? gps.accuracy : null,
      isMockSuspected: false,
      capturedAt: hasGps ? new Date().toISOString() : null,
      deviceId: getDeviceId(),
      allowDuplicate: duplicateResult?.allowOverride === true,
    };
    const result = await onSubmit(payload);
    setSubmitting(false);
    if (result.ok) onSaved(result.lead);
    else setError(result.error || "Couldn't save the lead — try again.");
  };

  return (
    <AddLeadOverlay onClose={onClose}>
      {!online && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: T.warn, background: T.warnSoft, padding: "8px 10px", borderRadius: 11, marginBottom: 12 }}>
          <WifiOff size={13} /> Offline — this will save to your device and sync when reconnected.
        </div>
      )}

      {locationSettings.gpsLocation && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
          <GpsStatus gps={gps} verification={verification} />
        </div>
      )}

      <div data-mobile-lead-section="restaurant"><AddLeadSection>Restaurant details</AddLeadSection></div>
      <AddLeadField label={`Business / Restaurant name${leadSettings.requireBusinessName ? " *" : ""}`}>
        <input style={inputStyle} value={form.business} onChange={set("business")} placeholder="e.g. Ganga Cafe" />
      </AddLeadField>
      <AddLeadField label={`Sub Location${leadSettings.requireSubLocation ? " *" : ""}`}>
        <input style={inputStyle} value={form.subLocation} onChange={set("subLocation")} placeholder="e.g. Gomti Nagar" list="sub-location-options" />
        <datalist id="sub-location-options">
          {(fieldOptions.sub_location || []).map((v) => <option key={v} value={v} />)}
        </datalist>
      </AddLeadField>
      <AddLeadField label={`POS Name${leadSettings.requirePosName ? " *" : ""}`}>
        <input style={inputStyle} value={form.posName} onChange={set("posName")} placeholder="Current POS/software being used" list="pos-name-options" />
        <datalist id="pos-name-options">
          {(fieldOptions.pos_name || []).map((v) => <option key={v} value={v} />)}
        </datalist>
      </AddLeadField>
      <AddLeadField label="Category">
        <input style={inputStyle} value={form.category} onChange={set("category")} placeholder="e.g. Cafe" list="category-options" />
        <datalist id="category-options">
          {(fieldOptions.category?.length ? fieldOptions.category : ["Cafe", "QSR", "Casual Dining", "Fine Dining", "Cloud Kitchen", "Bakery"]).map((v) => <option key={v} value={v} />)}
        </datalist>
      </AddLeadField>
      <div data-mobile-lead-section="contact"><AddLeadSection>Contact details</AddLeadSection></div>
      <AddLeadField label={`Contact Name${leadSettings.requireContactName ? " *" : ""}`}>
        <input style={inputStyle} value={form.owner} onChange={set("owner")} />
      </AddLeadField>
      <AddLeadField label={`Contact Number${leadSettings.requireContactNumber ? " *" : ""}`}>
        <div style={{ display: "flex", gap: 6 }}>
          <input style={{ ...inputStyle, marginBottom: 0, flex: 1 }} value={form.phone} onChange={set("phone")} />
          {contactPickerSupported && (
            <button
              type="button"
              onClick={pickContact}
              title="Pick from contacts"
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 12px", borderRadius: 8, border: `1px solid ${T.line}`, background: "#fff", color: T.route, fontWeight: 700, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap" }}
            >
              <Contact2 size={14} /> Pick
            </button>
          )}
        </div>
      </AddLeadField>
      <DuplicateLeadWarning result={duplicateResult} />
      <div data-mobile-lead-section="deal"><AddLeadSection>Deal &amp; follow-up</AddLeadSection></div>
      <div data-mobile-lead-stage="true"><AddLeadField label={`Stage${leadSettings.requireStatus ? " *" : ""}`}>
        <select style={inputStyle} value={form.status} onChange={set("status")}>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </AddLeadField></div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <AddLeadField label={`Expected Deal Value${leadSettings.requireDealValue ? " *" : ""}`}>
            <input style={inputStyle} type="number" min="0" inputMode="decimal" value={form.dealValue} onChange={set("dealValue")} placeholder="₹ e.g. 45000" />
          </AddLeadField>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <AddLeadField label={`Next Follow-up${leadSettings.requireFollowUpDate ? " *" : ""}`}>
            <input style={inputStyle} type="date" value={form.nextFollowUpDate} onChange={set("nextFollowUpDate")} />
          </AddLeadField>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <AddLeadField label="Renewal Month">
            <select style={inputStyle} value={form.renewalMonth} onChange={set("renewalMonth")}>
              <option value="">Select…</option>
              {MONTH_NAMES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </AddLeadField>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <AddLeadField label="Renewal Date"><input style={inputStyle} type="date" value={form.renewalDate} onChange={set("renewalDate")} /></AddLeadField>
        </div>
      </div>
      <div data-mobile-lead-comments="true"><AddLeadField label={`Comments${leadSettings.requireComments ? " *" : ""}`}>
        <textarea style={{ ...inputStyle, minHeight: 60 }} value={form.notes} onChange={set("notes")} />
      </AddLeadField></div>

      {error && <div style={{ fontSize: 12.5, color: T.danger, background: T.dangerSoft, borderRadius: 11, padding: "8px 10px", marginBottom: 12 }}>{error}</div>}

      <button
        data-mobile-lead-save="true"
        disabled={!canSubmit || submitting || duplicateResult?.blocking}
        onClick={handleSubmit}
        style={{ width: "100%", padding: "12px", borderRadius: 11, border: "none", cursor: canSubmit && !duplicateResult?.blocking ? "pointer" : "not-allowed", background: canSubmit && !duplicateResult?.blocking ? T.route : "#C7CDD6", color: "#fff", fontWeight: 700, fontSize: 14.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
      >
        {submitting && <Loader2 size={16} className="spin" />}
        {submitting ? "Saving…" : online ? "Save Lead" : "Save Lead (offline)"}
      </button>
    </AddLeadOverlay>
  );
}

function GpsStatus({ gps, verification }) {
  if (gps.state === "locating") return <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: T.inkSoft }}><Navigation size={14} className="spin" /> Getting your current GPS location…</div>;
  if (gps.state !== "ok") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: T.danger, background: T.dangerSoft, borderRadius: 11, padding: "8px 10px" }}>
        <AlertTriangle size={14} />
        {gps.state === "denied" ? "Location permission denied — allow it to capture a lead." : "GPS unavailable on this device/browser."}
      </div>
    );
  }
  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 11, padding: 10, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}>Captured location</span>
        <VerificationStamp status={verification} small />
      </div>
      <div>lat: {gps.lat.toFixed(6)}</div>
      <div>lng: {gps.lng.toFixed(6)}</div>
      <div>accuracy: ±{gps.accuracy} m</div>
      <div style={{ color: "#9AA5B1", fontFamily: "Inter, sans-serif", marginTop: 4 }}>Locked — cannot be edited manually.</div>
    </div>
  );
}

function MyLeadsModal({ leads, onClose, onSelectLead, title = "My Leads", allowDateFilter = false, embedded = false, employeeMobile = false, hasMore = false, onLoadMore, loadingMore = false, totalCount = null }) {
  const [briefLead, setBriefLead] = useState(null);
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [revenuePeriod, setRevenuePeriod] = useState("all"); // "all" | "month" — only shown for the Won Leads modal
  const [employeeDatePreset, setEmployeeDatePreset] = useState("all");
  const [employeeDateFrom, setEmployeeDateFrom] = useState("");
  const [employeeDateTo, setEmployeeDateTo] = useState("");
  const [employeeSort, setEmployeeSort] = useState("latest_activity");
  const isWonModal = title === "Won Leads";

  const localDayStart = (value) => {
    if (!value) return null;
    const date = value instanceof Date ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  };
  const leadActivityDate = (lead) => lead.updatedAt || lead.createdAt;
  const employeeDateMatches = (lead) => {
    if (!employeeMobile || employeeDatePreset === "all") return true;
    const activity = localDayStart(leadActivityDate(lead));
    if (!activity) return false;
    const today = localDayStart(new Date());
    const daysAgo = Math.floor((today - activity) / 86400000);
    if (employeeDatePreset === "today") return daysAgo === 0;
    if (employeeDatePreset === "yesterday") return daysAgo === 1;
    if (employeeDatePreset === "last7") return daysAgo >= 0 && daysAgo <= 6;
    if (employeeDatePreset === "last30") return daysAgo >= 0 && daysAgo <= 29;
    if (employeeDatePreset === "month") return activity.getFullYear() === today.getFullYear() && activity.getMonth() === today.getMonth();
    if (employeeDatePreset === "custom") {
      const from = employeeDateFrom ? localDayStart(`${employeeDateFrom}T00:00:00`) : null;
      const to = employeeDateTo ? localDayStart(`${employeeDateTo}T00:00:00`) : null;
      return (!from || activity >= from) && (!to || activity <= to);
    }
    return true;
  };
  const employeeAttention = (lead) => {
    const today = localDayStart(new Date());
    const followUp = lead.nextFollowUpDate ? localDayStart(`${String(lead.nextFollowUpDate).slice(0, 10)}T00:00:00`) : null;
    const terminal = lead.status === "won" || lead.status === "lost";
    if (followUp && !terminal) {
      const diff = Math.round((followUp - today) / 86400000);
      if (diff < 0) return { label: "Overdue", tone: "overdue" };
      if (diff === 0) return { label: "Due today", tone: "due" };
      if (diff === 1) return { label: "Due tomorrow", tone: "due" };
    }
    const activity = localDayStart(leadActivityDate(lead));
    if (!activity) return { label: "", tone: "normal" };
    const age = Math.max(0, Math.floor((today - activity) / 86400000));
    if (age === 0) return { label: "Today", tone: "normal" };
    if (age === 1) return { label: "Yesterday", tone: "normal" };
    if (age < 7) return { label: `${age} days ago`, tone: "normal" };
    return { label: `${age} days old`, tone: "stale" };
  };

  const filtered = leads.filter(
    (l) =>
      (!filterDate || l.createdAt.toISOString().slice(0, 10) === filterDate) &&
      (filterStatus === "all" || l.status === filterStatus) &&
      (!isWonModal || revenuePeriod === "all" || isThisMonth(l.createdAt)) &&
      employeeDateMatches(l) &&
      (!searchQuery.trim() || [l.business, l.owner, l.phone, l.subLocation].some((f) => f && f.toLowerCase().includes(searchQuery.trim().toLowerCase())))
  );
  const shown = employeeMobile ? [...filtered].sort((a, b) => {
    const activityA = new Date(leadActivityDate(a) || 0).getTime();
    const activityB = new Date(leadActivityDate(b) || 0).getTime();
    if (employeeSort === "oldest_activity") return activityA - activityB;
    if (employeeSort === "newest_lead") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (employeeSort === "oldest_lead") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (employeeSort === "follow_up") {
      const follow = (lead) => lead.nextFollowUpDate ? new Date(`${String(lead.nextFollowUpDate).slice(0, 10)}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;
      return follow(a) - follow(b) || activityB - activityA;
    }
    return activityB - activityA;
  }) : filtered;

  const totalRevenue = isWonModal ? shown.reduce((sum, l) => sum + (l.dealValue || 0), 0) : 0;

  const Frame = embedded ? EmbeddedLeads : Overlay;
  return (
    <Frame onClose={onClose} title={title}>
      {isWonModal && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, padding: "10px 12px", background: T.paperDeep, borderRadius: 11 }}>
          <div>
            <div style={{ fontSize: 10.5, color: T.inkSoft, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{revenuePeriod === "all" ? "All-time revenue" : "This month's revenue"}</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: T.verified }}>{fmtMoney(totalRevenue)}</div>
          </div>
          <div style={{ display: "flex", gap: 2, background: "#fff", borderRadius: 8, padding: 2, border: `1px solid ${T.line}` }}>
            <button
              onClick={() => setRevenuePeriod("all")}
              style={{ fontSize: 11.5, fontWeight: 600, padding: "5px 9px", borderRadius: 6, border: "none", cursor: "pointer", background: revenuePeriod === "all" ? T.route : "transparent", color: revenuePeriod === "all" ? "#fff" : T.inkSoft }}
            >
              All time
            </button>
            <button
              onClick={() => setRevenuePeriod("month")}
              style={{ fontSize: 11.5, fontWeight: 600, padding: "5px 9px", borderRadius: 6, border: "none", cursor: "pointer", background: revenuePeriod === "month" ? T.route : "transparent", color: revenuePeriod === "month" ? "#fff" : T.inkSoft }}
            >
              This month
            </button>
          </div>
        </div>
      )}
      <div style={{ position: "relative", marginBottom: 10 }}>
        <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: T.inkSoft }} />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by business, contact, phone, or area…"
          style={{ ...inputStyle, marginBottom: 0, width: "100%", padding: "9px 12px 9px 32px", boxSizing: "border-box" }}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", color: T.inkSoft }}>
            <X size={14} />
          </button>
        )}
      </div>
      {employeeMobile ? (
        <>
          <div className="employee-mobile-lead-filters">
            <select aria-label="Lead status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="all">Status</option>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <select aria-label="Lead date" value={employeeDatePreset} onChange={(e) => setEmployeeDatePreset(e.target.value)}>
              <option value="all">Date</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7">Last 7 days</option>
              <option value="last30">Last 30 days</option>
              <option value="month">This month</option>
              <option value="custom">Custom range</option>
            </select>
            <select aria-label="Lead sort" value={employeeSort} onChange={(e) => setEmployeeSort(e.target.value)}>
              <option value="latest_activity">Latest activity</option>
              <option value="oldest_activity">Oldest activity</option>
              <option value="newest_lead">Newest lead</option>
              <option value="oldest_lead">Oldest lead</option>
              <option value="follow_up">Follow-up due</option>
            </select>
          </div>
          {employeeDatePreset === "custom" && (
            <div className="employee-mobile-custom-date">
              <input aria-label="Date from" type="date" value={employeeDateFrom} onChange={(e) => setEmployeeDateFrom(e.target.value)} />
              <input aria-label="Date to" type="date" value={employeeDateTo} onChange={(e) => setEmployeeDateTo(e.target.value)} />
            </div>
          )}
        </>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {!isWonModal && (
            <Select value={filterStatus} onChange={setFilterStatus} options={[["all", "All statuses"], ...STATUSES.map((s) => [s, STATUS_LABEL[s]])]} />
          )}
          {allowDateFilter && (
            <>
              <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{ ...inputStyle, marginBottom: 0, flex: 1, minWidth: 130 }} />
              {filterDate && (
                <button onClick={() => setFilterDate("")} style={{ fontSize: 11.5, color: T.inkSoft, background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
                  Clear date
                </button>
              )}
            </>
          )}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {shown.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: T.inkSoft, fontSize: 13, padding: "30px 8px" }}>
            <List size={22} style={{ opacity: 0.5 }} />
            {filterDate || filterStatus !== "all" || searchQuery.trim() ? "No leads match these filters." : 'No leads yet — tap "Add Lead" to create one.'}
          </div>
        )}
        {shown.map((l) => (
          <div key={l.id} className="ft-row" onClick={() => onSelectLead(l)} style={{ border: `1px solid ${T.line}`, borderRadius: 11, padding: 10, background: "#fff", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div aria-hidden="true" style={leadAvatarStyle(l.business)}>{leadInitials(l.business)}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, minWidth: 0, overflowWrap: "anywhere" }}>{l.business}</div>
                  <button type="button" className="ft-lead-brief-pill" aria-label={`Brief for ${l.business}`} onClick={event => { event.stopPropagation(); setBriefLead(l); }}><Sparkles size={11} /> Brief</button>
                </div>
                <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 3, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {employeeMobile ? (() => {
                    const attention = employeeAttention(l);
                    return <span className={`employee-mobile-lead-meta employee-mobile-lead-meta--${attention.tone}`}><span>{STATUS_LABEL[l.status]}</span>{attention.label && <><span aria-hidden="true"> · </span><strong>{attention.label}</strong></>}</span>;
                  })() : <span>{STATUS_LABEL[l.status]} · {fmtTime(l.createdAt)}</span>}
              {l.renewalDate && (
                <span style={{ fontWeight: 700, color: T.accent }}>
                  Renews {new Date(l.renewalDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              )}
              <SyncBadge syncStatus={l.syncStatus} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {hasMore && onLoadMore && (
        <button type="button" disabled={loadingMore} onClick={onLoadMore} style={{ width:"100%", marginTop:12, padding:"10px 12px", borderRadius:9, border:`1px solid ${T.line}`, background:"#fff", color:T.route, fontWeight:800, cursor:loadingMore?"default":"pointer", opacity:loadingMore?.65:1 }}>
          {loadingMore ? "Loading more…" : `Load more leads${totalCount != null ? ` · ${Math.max(0, totalCount - leads.length)} remaining` : ""}`}
        </button>
      )}
      {briefLead && <LeadBriefPopup key={briefLead.id} lead={briefLead} buildBrief={buildLeadBrief} onClose={() => setBriefLead(null)} />}
    </Frame>
  );
}


function EmbeddedLeads({ title, children }) {
  return <section><h2 style={{ fontSize: 18, margin: "0 0 14px" }}>{title}</h2>{children}</section>;
}


  return { DuplicateLeadWarning, AddLeadField, AddLeadSection, AdminAddLeadModal, SalesmanFormModal, LeadDetailDrawer, SalesmanApp, adHocLeadFromPayload, MessagesSection, AddLeadOverlay, AddLeadModal, GpsStatus, MyLeadsModal, EmbeddedLeads };
}
