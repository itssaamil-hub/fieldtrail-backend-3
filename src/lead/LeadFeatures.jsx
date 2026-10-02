import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createLeadFeatures as createCoreLeadFeatures } from "./LeadFeaturesCore.jsx";
import { getApiBase, getSession } from "../api.js";
import { isWonDateInCurrentIstMonth, readAdminWonPeriod, writeAdminWonPeriod } from "./wonPeriod.js";

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
  const CoreMyLeadsModal = core.MyLeadsModal;

  function MyLeadsModal(props) {
    if (props.title !== "Won Leads") return <CoreMyLeadsModal {...props} />;

    const [period, setPeriod] = useState(() => readAdminWonPeriod());
    const currentWon = (props.leads || []).filter((lead) => lead.status === "won");
    const periodWon = period === "month"
      ? currentWon.filter((lead) => isWonDateInCurrentIstMonth(lead.wonDate))
      : currentWon;
    const revenue = periodWon.reduce((sum, lead) => sum + (Number(lead.dealValue) || 0), 0);

    const choosePeriod = (next) => {
      const saved = writeAdminWonPeriod(next);
      setPeriod(saved);
    };

    return (
      <deps.Overlay onClose={props.onClose} title="Won Leads">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, padding: "10px 12px", background: deps.T.paperDeep, borderRadius: 11 }}>
          <div>
            <div style={{ fontSize: 10.5, color: deps.T.inkSoft, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{period === "all" ? "All-time revenue" : "This month's revenue"}</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: deps.T.verified }}>{deps.fmtMoney(revenue)}</div>
          </div>
          <div style={{ display: "flex", gap: 2, background: "#fff", borderRadius: 8, padding: 2, border: `1px solid ${deps.T.line}` }}>
            <button
              onClick={() => choosePeriod("all")}
              style={{ fontSize: 11.5, fontWeight: 600, padding: "5px 9px", borderRadius: 6, border: "none", cursor: "pointer", background: period === "all" ? deps.T.route : "transparent", color: period === "all" ? "#fff" : deps.T.inkSoft }}
            >
              All time
            </button>
            <button
              onClick={() => choosePeriod("month")}
              style={{ fontSize: 11.5, fontWeight: 600, padding: "5px 9px", borderRadius: 6, border: "none", cursor: "pointer", background: period === "month" ? deps.T.route : "transparent", color: period === "month" ? "#fff" : deps.T.inkSoft }}
            >
              This month
            </button>
          </div>
        </div>
        <CoreMyLeadsModal
          {...props}
          title=" "
          leads={periodWon}
          embedded
          onClose={props.onClose}
        />
      </deps.Overlay>
    );
  }

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

  return { ...core, MyLeadsModal, LeadDetailDrawer };
}
