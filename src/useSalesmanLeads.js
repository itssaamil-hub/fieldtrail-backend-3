import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  ApiError,
  getQueuedLeads,
  pushQueuedLead,
  removeQueuedLead,
  mapLeadRow,
} from "./api.js";

const QUEUE_RETRY_BASE_MS = 20000;
const QUEUE_RETRY_JITTER_MS = 10000;

export default function useSalesmanLeads({ online, session, setLoadError, makeQueuedLead }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [queuedCount, setQueuedCount] = useState(getQueuedLeads().length);
  const queueFlightRef = useRef(null);
  const mountedRef = useRef(true);

  const loadLeads = useCallback(async () => {
    try {
      const res = await api.salesmanLeads();
      if (!mountedRef.current) return;
      setLeads((res.leads || []).map((r) => mapLeadRow({ ...r, salesman_name: session.fullName })));
      setLoadError("");
    } catch (err) {
      if (mountedRef.current) {
        setLoadError(err instanceof ApiError ? err.message : "Couldn't load your leads.");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [session.fullName, setLoadError]);

  useEffect(() => {
    mountedRef.current = true;
    loadLeads();
    return () => { mountedRef.current = false; };
  }, [loadLeads]);

  const flushQueue = useCallback(() => {
    if (queueFlightRef.current) return queueFlightRef.current;
    const queue = getQueuedLeads();
    if (queue.length === 0) {
      if (mountedRef.current) setQueuedCount(0);
      return Promise.resolve();
    }

    const request = (async () => {
      for (const payload of queue) {
        try {
          const res = await api.salesmanCreateLead(payload);
          removeQueuedLead(payload.clientUuid);
          if (mountedRef.current) {
            setLeads((prev) => prev.map((l) => (
              l.clientUuid === payload.clientUuid
                ? mapLeadRow({ ...res.lead, salesman_name: session.fullName })
                : l
            )));
          }
        } catch (err) {
          if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 0) {
            removeQueuedLead(payload.clientUuid);
          }
          break;
        }
      }

      if (mountedRef.current) setQueuedCount(getQueuedLeads().length);
    })().finally(() => {
      if (queueFlightRef.current === request) queueFlightRef.current = null;
    });

    queueFlightRef.current = request;
    return request;
  }, [session.fullName]);

  useEffect(() => {
    if (online && queuedCount > 0 && document.visibilityState === "visible") flushQueue();
  }, [online, queuedCount, flushQueue]);

  useEffect(() => {
    if (!online || queuedCount === 0) return undefined;
    let timerId = null;
    let stopped = false;

    const schedule = () => {
      if (stopped || getQueuedLeads().length === 0) return;
      const jitter = Math.floor(Math.random() * QUEUE_RETRY_JITTER_MS);
      timerId = window.setTimeout(run, QUEUE_RETRY_BASE_MS + jitter);
    };

    const run = async () => {
      if (stopped) return;
      if (document.visibilityState === "visible" && navigator.onLine !== false) await flushQueue();
      schedule();
    };

    const onResume = () => {
      if (!stopped && document.visibilityState === "visible" && navigator.onLine !== false) flushQueue();
    };

    schedule();
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("online", onResume);
    return () => {
      stopped = true;
      if (timerId) window.clearTimeout(timerId);
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("online", onResume);
    };
  }, [online, queuedCount, flushQueue]);

  const handleAddLead = async (payload) => {
    if (online) {
      try {
        const res = await api.salesmanCreateLead(payload);
        const mapped = mapLeadRow({ ...res.lead, salesman_name: session.fullName });
        setLeads((prev) => [mapped, ...prev]);
        return { ok: true, lead: mapped };
      } catch (err) {
        if (!(err instanceof ApiError) || err.status === 0) {
          pushQueuedLead(payload);
          setQueuedCount(getQueuedLeads().length);
          const queued = { ...makeQueuedLead(payload), syncStatus: "queued" };
          setLeads((prev) => [queued, ...prev]);
          return { ok: true, lead: queued };
        }
        return { ok: false, error: err.message };
      }
    }

    pushQueuedLead(payload);
    setQueuedCount(getQueuedLeads().length);
    const queued = { ...makeQueuedLead(payload), syncStatus: "queued" };
    setLeads((prev) => [queued, ...prev]);
    return { ok: true, lead: queued };
  };

  const handleUpdateLeadStatus = async (id, status) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    try {
      await api.salesmanUpdateLead(id, { status });
    } catch {
      // Keep the optimistic value; the next load reconciles with the server.
    }
  };

  const handleUpdateLeadDetails = async (id, payload) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? {
      ...l,
      business: payload.businessName ?? l.business,
      subLocation: payload.subLocation,
      posName: payload.posName,
      renewalMonth: payload.renewalMonth,
      renewalDate: payload.renewalDate || "",
      owner: payload.contactName,
      phone: payload.phone,
      notes: payload.notes,
      dealValue: payload.dealValue,
    } : l)));
    try {
      await api.salesmanUpdateLead(id, payload);
    } catch {
      // Keep the optimistic value; later data refresh reconciles it.
    }
  };

  return {
    leads,
    loading,
    queuedCount,
    loadLeads,
    handleAddLead,
    handleUpdateLeadStatus,
    handleUpdateLeadDetails,
  };
}
