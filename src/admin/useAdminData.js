import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, getWsBase, mapLeadRow, mapSalesmanRow } from "../api.js";

const HEALTHY_REFRESH_MS = 120000;
const DISCONNECTED_REFRESH_MS = 15000;
const VISIBLE_STALE_MS = 60000;
const RECONNECT_DELAYS_MS = [4000, 8000, 15000, 30000];

const errorMessage = (err, fallback) => err instanceof ApiError ? err.message : fallback;

function mappedLeadFromResponse(result) {
  const row = result?.lead || result?.data?.lead || result;
  if (!row?.id) return null;
  if (row.business_name != null || row.created_at != null) return mapLeadRow(row);
  if (row.business != null && row.createdAt != null) return row;
  return null;
}

function mappedSalesmanFromResponse(result) {
  const row = result?.salesman || result?.employee || result?.data?.salesman || result;
  if (!row?.id) return null;
  if (row.full_name != null) return mapSalesmanRow(row);
  if (row.name != null) return row;
  return null;
}

export default function useAdminData({ online, session }) {
  const [conversationCount, setConversationCount] = useState(null);
  const [salesmen, setSalesmen] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [wsConnected, setWsConnected] = useState(false);

  const loadAllInFlightRef = useRef(null);
  const summaryInFlightRef = useRef(null);
  const lastRefreshAtRef = useRef(0);
  const wsRef = useRef(null);

  const refreshSummary = useCallback(() => {
    if (summaryInFlightRef.current) return summaryInFlightRef.current;
    const request = api.adminSummary()
      .then((summary) => setConversationCount(summary?.conversationLeads ?? null))
      .catch(() => null);
    summaryInFlightRef.current = request.finally(() => {
      summaryInFlightRef.current = null;
    });
    return summaryInFlightRef.current;
  }, []);

  const refreshSalesmen = useCallback(async () => {
    const result = await api.adminSalesmen();
    setSalesmen((result.salesmen || []).map(mapSalesmanRow));
  }, []);

  const loadAll = useCallback(() => {
    if (loadAllInFlightRef.current) return loadAllInFlightRef.current;

    const request = (async () => {
      try {
        const [salesmenRes, leadsRes, summaryRes] = await Promise.all([
          api.adminSalesmen(),
          api.adminLeads(),
          api.adminSummary(),
        ]);
        setConversationCount(summaryRes.conversationLeads ?? null);
        setSalesmen((salesmenRes.salesmen || []).map(mapSalesmanRow));
        setLeads((leadsRes.leads || []).map(mapLeadRow));
        setLoadError("");
        lastRefreshAtRef.current = Date.now();
      } catch (err) {
        setLoadError(errorMessage(err, "Couldn't load data."));
      } finally {
        setLoading(false);
      }
    })();

    loadAllInFlightRef.current = request.finally(() => {
      loadAllInFlightRef.current = null;
    });
    return loadAllInFlightRef.current;
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Full refresh is only a safety net. Realtime-connected admins refresh rarely;
  // disconnected admins keep the existing 15-second fallback. Hidden tabs do no polling.
  useEffect(() => {
    if (!online) return undefined;
    const intervalMs = wsConnected ? HEALTHY_REFRESH_MS : DISCONNECTED_REFRESH_MS;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") loadAll();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [online, wsConnected, loadAll]);

  // Reconcile after a long background period instead of continuously polling while hidden.
  useEffect(() => {
    if (!online) return undefined;
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastRefreshAtRef.current >= VISIBLE_STALE_MS) loadAll();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [online, loadAll]);

  // Realtime updates with exponential reconnect backoff plus jitter so multiple
  // admin clients do not reconnect to Render at the same instant after an outage.
  useEffect(() => {
    if (!online || !session?.token) return undefined;
    let cancelled = false;
    let retryTimer = null;
    let attempt = 0;

    const scheduleReconnect = () => {
      if (cancelled) return;
      const base = RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)];
      attempt += 1;
      const jitter = 0.8 + Math.random() * 0.4;
      retryTimer = window.setTimeout(connect, Math.round(base * jitter));
    };

    const connect = () => {
      if (cancelled) return;
      const wsBase = getWsBase();
      if (!wsBase) return;
      const ws = new WebSocket(`${wsBase}/realtime/admin?token=${encodeURIComponent(session.token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        setWsConnected(true);
      };
      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        setWsConnected(false);
        scheduleReconnect();
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (evt) => {
        let msg;
        try { msg = JSON.parse(evt.data); } catch { return; }
        if (msg.type === "location_update" || msg.type === "salesman_status") {
          const s = msg.salesman;
          if (!s?.id) return;
          setSalesmen((prev) => prev.map((person) => person.id === s.id ? {
            ...person,
            lat: s.lat != null ? s.lat : person.lat,
            lng: s.lng != null ? s.lng : person.lng,
            battery: s.batteryPct != null ? s.batteryPct : person.battery,
            speed: s.speedMps != null ? s.speedMps * 3.6 : person.speed,
            status: s.status || person.status,
            lastUpdate: s.lastSeenAt ? new Date(s.lastSeenAt) : person.lastUpdate,
          } : person));
        } else if (msg.type === "new_lead" && msg.lead) {
          const mapped = mappedLeadFromResponse(msg.lead);
          if (!mapped) return;
          setLeads((prev) => prev.some((lead) => lead.id === mapped.id) ? prev : [mapped, ...prev]);
          refreshSummary();
        } else if (msg.type === "lead_status_changed") {
          setLeads((prev) => prev.map((lead) => lead.id === msg.leadId ? { ...lead, status: msg.status } : lead));
          refreshSummary();
        }
      };
    };

    connect();
    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      setWsConnected(false);
    };
  }, [online, session?.token, refreshSummary]);

  const onStatusChange = useCallback(async (id, status) => {
    setLeads((prev) => prev.map((lead) => lead.id === id ? { ...lead, status } : lead));
    try {
      await api.adminUpdateLeadStatus(id, status);
      refreshSummary();
    } catch (err) {
      setLoadError(errorMessage(err, "Couldn't update status."));
      loadAll();
    }
  }, [loadAll, refreshSummary]);

  const onUpdateLead = useCallback(async (id, payload) => {
    setLeads((prev) => prev.map((lead) => lead.id === id ? {
      ...lead,
      business: payload.businessName ?? lead.business,
      subLocation: payload.subLocation,
      posName: payload.posName,
      renewalMonth: payload.renewalMonth,
      renewalDate: payload.renewalDate || "",
      nextFollowUpDate: payload.nextFollowUpDate ?? lead.nextFollowUpDate,
      owner: payload.contactName,
      phone: payload.phone,
      notes: payload.notes,
      dealValue: payload.dealValue,
    } : lead));
    try {
      const result = await api.adminUpdateLead(id, payload);
      const mapped = mappedLeadFromResponse(result);
      if (mapped) setLeads((prev) => prev.map((lead) => lead.id === id ? mapped : lead));
    } catch (err) {
      setLoadError(errorMessage(err, "Couldn't save changes."));
      loadAll();
    }
  }, [loadAll]);

  const onDeleteLead = useCallback(async (id) => {
    setLeads((prev) => prev.filter((lead) => lead.id !== id));
    try {
      await api.adminDeleteLead(id);
      refreshSummary();
    } catch (err) {
      setLoadError(errorMessage(err, "Couldn't delete the lead."));
      loadAll();
    }
  }, [loadAll, refreshSummary]);

  const onAddLead = useCallback(async (payload) => {
    const result = await api.adminCreateLead(payload);
    const mapped = mappedLeadFromResponse(result);
    if (mapped) {
      setLeads((prev) => [mapped, ...prev.filter((lead) => lead.id !== mapped.id)]);
      refreshSummary();
    } else {
      await loadAll();
    }
    return result;
  }, [loadAll, refreshSummary]);

  const onAddSalesman = useCallback(async (payload) => {
    const result = await api.adminCreateSalesman(payload);
    const mapped = mappedSalesmanFromResponse(result);
    if (mapped) setSalesmen((prev) => [...prev.filter((person) => person.id !== mapped.id), mapped]);
    else await refreshSalesmen();
    return result;
  }, [refreshSalesmen]);

  const onToggleSalesmanActive = useCallback(async (id, nextIsActive) => {
    setSalesmen((prev) => prev.map((person) => person.id === id ? { ...person, isActive: nextIsActive } : person));
    try {
      const result = await api.adminUpdateSalesman(id, { isActive: nextIsActive });
      const mapped = mappedSalesmanFromResponse(result);
      if (mapped) setSalesmen((prev) => prev.map((person) => person.id === id ? { ...person, ...mapped } : person));
    } catch (err) {
      setLoadError(errorMessage(err, "Couldn't update employee."));
      refreshSalesmen().catch(() => loadAll());
    }
  }, [loadAll, refreshSalesmen]);

  const onEditSalesman = useCallback(async (id, payload) => {
    const result = await api.adminUpdateSalesman(id, payload);
    const mapped = mappedSalesmanFromResponse(result);
    if (mapped) setSalesmen((prev) => prev.map((person) => person.id === id ? { ...person, ...mapped } : person));
    else await refreshSalesmen();
    return result;
  }, [refreshSalesmen]);

  const onDeleteSalesman = useCallback(async (id) => {
    const result = await api.adminDeleteSalesman(id);
    setSalesmen((prev) => prev.filter((person) => person.id !== id));
    return result;
  }, []);

  return {
    conversationCount,
    salesmen,
    leads,
    loading,
    loadError,
    wsConnected,
    loadAll,
    onStatusChange,
    onUpdateLead,
    onDeleteLead,
    onAddLead,
    onAddSalesman,
    onEditSalesman,
    onDeleteSalesman,
    onToggleSalesmanActive,
  };
}
