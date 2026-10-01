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

function presentWonDateAudit(item) {
  if (item?.action !== "lead.won_date_changed") return item;
  return {
    ...item,
    action: "lead.edited",
    changes: {
      "Won Date": { from: item.old_value || null, to: item.new_value || null },
    },
  };
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
    const [historyVersion, setHistoryVersion] = useState(0);

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

    const wrappedFetchHistory = useMemo(() => {
      if (!props.fetchHistory) return undefined;
      return async (leadId) => {
        const result = await props.fetchHistory(leadId);
        return {
          ...result,
          history: (result?.history || []).map(presentWonDateAudit),
        };
      };
    }, [props.fetchHistory, historyVersion]);

    const onUpdate = async (leadId, payload) => {
      if (!props.onUpdate) return undefined;
      const isEditSave = payload && Object.prototype.hasOwnProperty.call(payload, "businessName");
      const includeWonDate = enabled && isEditSave && wonDate && !loading && !error;
      const nextPayload = includeWonDate ? { ...payload, wonDate } : payload;
      const result = await props.onUpdate(leadId, nextPayload);
      if (includeWonDate) setHistoryVersion((value) => value + 1);
      return result;
    };

    return (
      <WonDateContext.Provider value={contextValue}>
        <CoreLeadDetailDrawer
          {...props}
          fetchHistory={wrappedFetchHistory}
          onUpdate={props.onUpdate ? onUpdate : undefined}
        />
      </WonDateContext.Provider>
    );
  }

  return { ...core, LeadDetailDrawer };
}
