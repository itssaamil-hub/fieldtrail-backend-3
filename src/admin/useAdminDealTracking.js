import { useCallback, useEffect, useRef, useState } from "react";
import { api, mapLeadRow } from "../api.js";

// Only active while the Admin Deals Pipeline is filtered to monthly tracking.
// Never changes a deal or the employee's monthly list.
export default function useAdminDealTracking({ enabled, month }) {
  const [result, setResult] = useState({ month: "", rows: [], loading: false, error: "" });
  const requestSequence = useRef(0);

  const refresh = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setResult(previous => ({ month, rows: previous.month === month ? previous.rows : [],
      loading: previous.month !== month || !previous.rows.length, error: "" }));
    try {
      const response = await api.adminDealTracking(month);
      if (requestSequence.current !== sequence) return;
      setResult({ month, rows: (response.deals || []).map(mapLeadRow), loading: false, error: "" });
    } catch (err) {
      if (requestSequence.current !== sequence) return;
      setResult({ month, rows: [], loading: false, error: err.message || "Unable to load tracked deals." });
    }
  }, [month]);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    const onFocus = () => { if (document.visibilityState === "visible") refresh(); };
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 60000);
    return () => {
      requestSequence.current += 1;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [enabled, refresh]);

  return {
    rows: enabled && result.month === month ? result.rows : [],
    loading: enabled && (result.month !== month || result.loading),
    error: enabled && result.month === month ? result.error : "",
    refresh,
  };
}
