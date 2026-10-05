import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
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

  // The legacy core originally booted the Add Deal GPS state as ON before the
  // employee-specific policy request completed. That could wake the device GPS
  // for a fraction of a second even when Admin had set this employee to GPS OFF.
  // Start this one exact state shape as OFF instead. The existing settings effect
  // turns it ON only after the authoritative employee policy says so. A settings
  // failure therefore fails closed and never fabricates permission to acquire GPS.
  const locationSafeUseState = (initialValue) => {
    const isLegacyLocationDefault = initialValue && typeof initialValue === "object"
      && initialValue.gpsLocation === true
      && initialValue.locationMandatoryForNewLead === true
      && initialValue.continuousGpsTracking === true
      && Object.keys(initialValue).length === 3;
    return useState(isLegacyLocationDefault
      ? { gpsLocation: false, locationMandatoryForNewLead: false, continuousGpsTracking: false }
      : initialValue);
  };

  // "Allow lead entry without Start Day / GPS" is scoped to lead creation only.
  // The core Add Deal modal reads salesmanGetSettings directly, so present GPS as
  // OFF to that lead-capture path when the employee is trusted. Attendance and
  // continuous tracking keep using useSalesmanSettings, which reads the real
  // employee GPS policy independently and is therefore unchanged.
  const leadCaptureApi = {
    ...deps.api,
    salesmanGetSettings: async (...args) => {
      const result = await deps.api.salesmanGetSettings(...args);
      if (result?.employeePermissions?.allowLeadWithoutStartDay !== true) return result;
      return {
        ...result,
        locationSettings: {
          ...(result.locationSettings || {}),
          gpsLocation: false,
          locationMandatoryForNewLead: false,
          continuousGpsTracking: false,
        },
      };
    },
  };

  const core = createCoreLeadFeatures({ ...deps, api: leadCaptureApi, useState: locationSafeUseState, Field: FieldWithWonDate });
  const CoreLeadDetailDrawer = core.LeadDetailDrawer;
  const CoreMyLeadsModal = core.MyLeadsModal;

  function MyLeadsModal(props) {
    const isWonModal = props.title === "Won Leads";
    const [period, setPeriod] = useState(() => readAdminWonPeriod());
    const [resolvedWonDates, setResolvedWonDates] = useState({});
    const [wonDatesLoading, setWonDatesLoading] = useState(false);
    const [wonDatesError, setWonDatesError] = useState("");

    useEffect(() => {
      if (!isWonModal) return undefined;
      const currentWon = (props.leads || []).filter((lead) => lead.status === "won");
      const missing = currentWon.filter((lead) => !lead.wonDate && !resolvedWonDates[lead.id]);
      if (!missing.length) {
        setWonDatesLoading(false);
        setWonDatesError("");
        return undefined;
      }

      let cancelled = false;
      setWonDatesLoading(true);
      setWonDatesError("");
      Promise.allSettled(missing.map(async (lead) => [lead.id, await fetchWonDate(lead.id)]))
        .then((results) => {
          if (cancelled) return;
          const updates = {};
          let failed = false;
          results.forEach((result) => {
            if (result.status === "fulfilled" && result.value[1]) updates[result.value[0]] = result.value[1];
            else failed = true;
          });
          if (Object.keys(updates).length) setResolvedWonDates((current) => ({ ...current, ...updates }));
          if (failed) setWonDatesError("Some canonical Won Dates could not be verified.");
        })
        .finally(() => { if (!cancelled) setWonDatesLoading(false); });
      return () => { cancelled = true; };
    }, [isWonModal, props.leads]);

    if (!isWonModal) return <CoreMyLeadsModal {...props} />;

    const currentWon = (props.leads || [])
      .filter((lead) => lead.status === "won")
      .map((lead) => ({ ...lead, wonDate: lead.wonDate || resolvedWonDates[lead.id] || null }));
    const missingCanonicalWonDate = currentWon.some((lead) => !lead.wonDate);
    const monthDataVerified = !wonDatesLoading && !missingCanonicalWonDate && !wonDatesError;
    const periodWon = period === "month"
      ? (monthDataVerified ? currentWon.filter((lead) => isWonDateInCurrentIstMonth(lead.wonDate)) : [])
      : currentWon;
    const revenue = period === "month" && !monthDataVerified
      ? null
      : periodWon.reduce((sum, lead) => sum + (Number(lead.dealValue) || 0), 0);

    const choosePeriod = (next) => {
      const saved = writeAdminWonPeriod(next);
      setPeriod(saved);
    };

    return (
      <deps.Overlay onClose={props.onClose} title="Won Leads">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, padding: "10px 12px", background: deps.T.paperDeep, borderRadius: 11 }}>
          <div>
            <div style={{ fontSize: 10.5, color: deps.T.inkSoft, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{period === "all" ? "All-time revenue" : "This month's revenue"}</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: deps.T.verified }}>{revenue == null ? "—" : deps.fmtMoney(revenue)}</div>
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
        {period === "month" && wonDatesLoading && <div role="status" style={{ marginBottom: 10, fontSize: 12, color: deps.T.inkSoft }}>Verifying canonical Won Dates…</div>}
        {period === "month" && !wonDatesLoading && (wonDatesError || missingCanonicalWonDate) && <div role="alert" style={{ marginBottom: 10, padding: "8px 10px", borderRadius: 9, background: deps.T.warnSoft, color: deps.T.warn, fontSize: 12, fontWeight: 650 }}>This Month is hidden until every Won Date is verified. All Time remains accurate.</div>}
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
    const [paymentDeleteWarning, setPaymentDeleteWarning] = useState(null);
    const deleteGuardRef = useRef(false);

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

    const closeDeleteWarning = () => {
      deleteGuardRef.current = false;
      setPaymentDeleteWarning(null);
    };

    const guardedClose = () => {
      if (deleteGuardRef.current) return;
      props.onClose?.();
    };

    const guardedDelete = async (leadId) => {
      if (!props.onDelete) return;
      deleteGuardRef.current = true;
      setPaymentDeleteWarning({ state: "checking", leadId });
      try {
        let hasPayments = false;
        try {
          const collection = await deps.api.collection(`lead:${leadId}`);
          hasPayments = Array.isArray(collection?.payments) && collection.payments.length > 0;
        } catch (err) {
          if (!(err instanceof deps.ApiError) || err.status !== 404) throw err;
        }

        if (hasPayments) {
          setPaymentDeleteWarning({ state: "warning", leadId });
          return;
        }

        await props.onDelete(leadId);
        deleteGuardRef.current = false;
        setPaymentDeleteWarning(null);
        props.onClose?.();
      } catch (err) {
        setPaymentDeleteWarning({
          state: "error",
          leadId,
          message: err?.message || "Couldn't verify payment history. Please try again.",
        });
      }
    };

    const confirmPaymentDelete = async () => {
      const leadId = paymentDeleteWarning?.leadId;
      if (!leadId || !props.onDelete) return;
      setPaymentDeleteWarning((current) => ({ ...current, state: "deleting" }));
      try {
        await props.onDelete(leadId);
        deleteGuardRef.current = false;
        setPaymentDeleteWarning(null);
        props.onClose?.();
      } catch (err) {
        setPaymentDeleteWarning((current) => ({
          ...current,
          state: "error",
          message: err?.message || "Couldn't delete this Deal. Please try again.",
        }));
      }
    };

    return (
      <WonDateContext.Provider value={contextValue}>
        <CoreLeadDetailDrawer
          {...props}
          onClose={guardedClose}
          fetchHistory={wrappedFetchHistory}
          onUpdate={props.onUpdate ? onUpdate : undefined}
          onDelete={props.onDelete ? guardedDelete : undefined}
        />

        {paymentDeleteWarning?.state === "warning" && (
          <deps.Overlay onClose={closeDeleteWarning} title="Delete Deal permanently?">
            <div role="alert" style={{ background: deps.T.dangerSoft, border: `1px solid ${deps.T.danger}33`, borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: deps.T.danger, marginBottom: 7 }}>
                This Deal is associated with payment records.
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.55, color: deps.T.ink, marginBottom: 14 }}>
                Deleting it will also permanently delete its payment account and payment history. This action cannot be undone.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={closeDeleteWarning} style={{ flex: 1, padding: 10, borderRadius: 8, border: `1px solid ${deps.T.line}`, background: "#fff", color: deps.T.ink, fontWeight: 700, cursor: "pointer" }}>
                  Cancel
                </button>
                <button onClick={confirmPaymentDelete} style={{ flex: 1, padding: 10, borderRadius: 8, border: "none", background: deps.T.danger, color: "#fff", fontWeight: 800, cursor: "pointer" }}>
                  Delete permanently
                </button>
              </div>
            </div>
          </deps.Overlay>
        )}

        {paymentDeleteWarning?.state === "error" && (
          <deps.Overlay onClose={closeDeleteWarning} title="Delete Deal">
            <div role="alert" style={{ background: deps.T.warnSoft, borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 12.5, lineHeight: 1.5, color: deps.T.warn, marginBottom: 12 }}>
                {paymentDeleteWarning.message}
              </div>
              <button onClick={closeDeleteWarning} style={{ width: "100%", padding: 10, borderRadius: 8, border: `1px solid ${deps.T.line}`, background: "#fff", color: deps.T.ink, fontWeight: 700, cursor: "pointer" }}>
                Close
              </button>
            </div>
          </deps.Overlay>
        )}
      </WonDateContext.Provider>
    );
  }

  return { ...core, MyLeadsModal, LeadDetailDrawer };
}
