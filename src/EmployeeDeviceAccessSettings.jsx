import React, { useEffect, useState } from "react";
import { api } from "./api.js";

const CHOICES = [
  { value: "both", label: "Mobile + Desktop", description: "Employee can sign in from both phone and laptop. This is the default." },
  { value: "mobile_only", label: "Mobile Only", description: "Block normal laptop and desktop browsers. The employee must use an Android phone or iPhone." },
];

export default function EmployeeDeviceAccessSettings({ employeeId }) {
  const [savedPolicy, setSavedPolicy] = useState(null);
  const [draft, setDraft] = useState("both");
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setNotice(""); setSavedPolicy(null);
    api.adminGetEmployeeDevicePolicy(employeeId).then((data) => {
      if (!active) return;
      setSavedPolicy(data.policy);
      setDraft(data.policy);
      setVersion(Number(data.version) || 0);
    }).catch((err) => {
      if (active) setError(err.message || "Could not load device access.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [employeeId]);

  const save = async () => {
    if (saving || savedPolicy === null || draft === savedPolicy) return;
    if (draft === "mobile_only" && !window.confirm(
      "Set this employee to Mobile Only? All existing sessions for this employee will be signed out. Check that they can log in on a phone before continuing."
    )) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await api.adminSaveEmployeeDevicePolicy(employeeId, { policy: draft, version });
      setSavedPolicy(result.policy);
      setDraft(result.policy);
      setVersion(result.version);
      setNotice("Device access policy saved.");
    } catch (err) {
      setError(err.message || "Could not save device access.");
    } finally {
      setSaving(false);
    }
  };

  return <div data-device-access-settings="true" className="ft-q-box" style={{ marginTop: 14 }}>
    <h3 style={{ margin: "0 0 4px" }}>Device Access</h3>
    <p className="ft-ob-muted" style={{ marginTop: 0, lineHeight: 1.55 }}>Control how this employee can access Engage CRM. This setting applies to this salesman only; Admin access is unchanged.</p>
    {loading && <p role="status" className="ft-ob-muted">Loading employee device policy…</p>}
    {error && <p role="alert" style={{ color: "#b42318" }}>{error}</p>}
    {!loading && savedPolicy !== null && <>
      <div role="radiogroup" aria-label="Allowed devices" style={{ display: "grid", gap: 9 }}>
        {CHOICES.map(({ value, label, description }) => (
          <label key={value} style={{
            display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0,
            border: "1px solid " + (draft === value ? "#145C5D" : "#e2e9e5"),
            borderRadius: 11, padding: 13,
            background: draft === value ? "#f3faf8" : "#fff", cursor: saving ? "wait" : "pointer",
          }}>
            <input type="radio" name="employee-device-policy" value={value} disabled={saving}
              checked={draft === value}
              onChange={() => { setDraft(value); setError(""); setNotice(""); }}
              style={{ width: 18, height: 18, marginTop: 1, accentColor: "#145C5D", flexShrink: 0 }}/>
            <span style={{ minWidth: 0 }}>
              <strong style={{ display: "block", fontSize: 13.5, color: "#20332f" }}>{label}</strong>
              <span style={{ display: "block", fontSize: 12, lineHeight: 1.5, color: "#6f7a75", marginTop: 3 }}>{description}</span>
            </span>
          </label>
        ))}
      </div>
      {draft === "mobile_only" && <p style={{ fontSize: 12, lineHeight: 1.55, padding: 11, borderRadius: 10, background: "#fff6e5", color: "#75500d", marginTop: 12 }}>
        Mobile Only will block normal laptop sign-ins. When you save, this employee will need to sign in again on their phone; all existing sessions will be invalidated.
      </p>}
      <p className="ft-ob-muted" style={{ fontSize: 11.5, lineHeight: 1.5, marginTop: 10 }}>
        Browser identification is not hardware verification; technically skilled users can spoof a mobile browser. This policy deters ordinary desktop access but does not prove the device is a physical phone.
      </p>
      <button type="button" className="ft-ob-primary" style={{ marginTop: 10 }}
        disabled={saving || draft === savedPolicy} onClick={save}>
        {saving ? "Saving…" : "Save Device Access"}
      </button>
      {notice && <p role="status" style={{ color: "#12805C", fontSize: 12 }}>{notice}</p>}
    </>}
  </div>;
}
