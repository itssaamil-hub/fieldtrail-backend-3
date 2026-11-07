import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { currentTrackingMonth } from "../utils/dealTrackingMonth.js";

// Employee-only monthly membership control. This never changes CRM stage.
export default function LeadTrackingButton({ leadId, employeeId, T }) {
  const [tracked, setTracked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setTracked(false);
    setLoading(true);
    setError("");
    api.salesmanMonthlyFocus(currentTrackingMonth(), employeeId)
      .then(result => {
        if (alive) setTracked((result.items || []).some(item => item.id === leadId));
      })
      .catch(err => {
        if (alive) setError(err.message || "Could not check monthly tracking. Reopen this section to retry.");
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [leadId, employeeId]);

  const toggle = async () => {
    if (busy || loading || error) return;
    setBusy(true);
    try {
      const month = currentTrackingMonth();
      if (tracked) await api.salesmanMonthlyFocusRemove(month, leadId, employeeId);
      else await api.salesmanMonthlyFocusAdd(month, leadId, employeeId);
      setTracked(value => !value);
      window.dispatchEvent(new Event("engage:monthly-focus-changed"));
    } catch (err) {
      setError(err.message || "Could not save tracking. Reopen this section to retry.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ flexShrink: 0, textAlign: "right" }}>
      <button type="button" aria-label={tracked ? "Stop tracking deal" : "Track Deal"} aria-pressed={tracked}
        disabled={loading || busy || !!error} onClick={toggle}
        style={{ border: "1px solid " + (tracked ? T.route : T.line), borderRadius: 8,
          background: tracked ? "#EAF5F0" : "#fff", color: tracked ? T.route : T.ink,
          minHeight: 32, padding: "5px 9px", fontSize: 11.5, fontWeight: 750,
          opacity: loading || busy ? .6 : 1, cursor: loading || busy || error ? "default" : "pointer",
          whiteSpace: "nowrap" }}>
        {loading ? "Checking…" : busy ? "Saving…" : tracked ? "✓ Tracking" : "◎ Track Deal"}
      </button>
      {error && <div role="alert" style={{ fontSize: 10.5, color: T.danger, maxWidth: 155, overflowWrap: "anywhere" }}>{error}</div>}
    </div>
  );
}
