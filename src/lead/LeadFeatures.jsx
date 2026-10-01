import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createLeadFeatures as createCoreLeadFeatures } from "./LeadFeaturesCore.jsx";
import { getApiBase, getSession } from "../api.js";

const WonDateContext = createContext(null);

async function fetchWonDate(leadId) {
  const base = getApiBase();
  const token = getSession()?.token;
  if (!base || !token) throw new Error("Won Date is unavailable right now.");
  const response = await fetch(`${base}/admin/leads/${encodeURIComponent(leadId)}/won-date`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  let data = null;
  try { data = await response.json(); } catch { /* handled below */ }
  if (!response.ok) throw new Error(data?.error || "Couldn't load Won Date.");
  return data?.wonDate || "";
}

export function createLeadFeatures(deps) {
  const BaseField = deps.Field;

  function FieldWithWonDate(props) {
    const won = useContext(WonDateContext);
    return <>
      {won?.enabled && props.label === "Comments" && (
        <BaseField label="Won Date">
          <input
            style={deps.inputStyle}
            type="date"
            value={won.value}
            disabled={won.loading || !!won.error}
            onChange={(event) => won.onChange(event.target.value)}
          />
          {won.loading && <div style={{ marginTop: 4, fontSize: 11.5, color: deps.T.inkSoft }}>Loading Won Date…</div>}
          {won.error && <div style={{ marginTop: 4, fontSize: 11.5, color: deps.T.danger }}>{won.error}</div>}
        </BaseField>
      )}
      <BaseField {...props} />
    </>;
  }

  const core = createCoreLeadFeatures({ ...deps, Field: FieldWithWonDate });
  const CoreLeadDetailDrawer = core.LeadDetailDrawer;

  function LeadDetailDrawer(props) {
    const enabled = !!props.isAdmin && props.lead?.status === "won";
    const [wonDate, setWonDate] = useState("");
    const [loading, setLoading] = useState(enabled);
    const [error, setError] = useState("");

    useEffect(() => {
      let cancelled = false;
      if (!enabled) {
        setWonDate("");
        setLoading(false);
        setError("");
        return () => { cancelled = true; };
      }
      setLoading(true);
      setError("");
      fetchWonDate(props.lead.id)
        .then((value) => { if (!cancelled) setWonDate(value); })
        .catch((err) => { if (!cancelled) setError(err.message || "Couldn't load Won Date."); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [enabled, props.lead?.id]);

    const contextValue = useMemo(() => ({
      enabled,
      value: wonDate,
      loading,
      error,
      onChange: setWonDate,
    }), [enabled, wonDate, loading, error]);

    const onUpdate = async (leadId, payload) => {
      if (!props.onUpdate) return undefined;
      const isEditSave = payload && Object.prototype.hasOwnProperty.call(payload, "businessName");
      const nextPayload = enabled && isEditSave && wonDate && !loading && !error
        ? { ...payload, wonDate }
        : payload;
      return props.onUpdate(leadId, nextPayload);
    };

    return (
      <WonDateContext.Provider value={contextValue}>
        <CoreLeadDetailDrawer {...props} onUpdate={props.onUpdate ? onUpdate : undefined} />
      </WonDateContext.Provider>
    );
  }

  return { ...core, LeadDetailDrawer };
}
