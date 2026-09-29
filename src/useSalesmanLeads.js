import { useCallback, useEffect, useState } from "react";
import {
  api,
  ApiError,
  getQueuedLeads,
  pushQueuedLead,
  removeQueuedLead,
  mapLeadRow,
} from "./api.js";

export default function useSalesmanLeads({ online, session, setLoadError, makeQueuedLead }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [queuedCount, setQueuedCount] = useState(getQueuedLeads().length);

  const loadLeads = useCallback(async () => {
    try {
      const res = await api.salesmanLeads();
      setLeads((res.leads || []).map((r) => mapLeadRow({ ...r, salesman_name: session.fullName })));
      setLoadError("");
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Couldn't load your leads.");
    } finally {
      setLoading(false);
    }
  }, [session.fullName, setLoadError]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  const flushQueue = useCallback(async () => {
    const queue = getQueuedLeads();
    if (queue.length === 0) return;

    for (const payload of queue) {
      try {
        const res = await api.salesmanCreateLead(payload);
        removeQueuedLead(payload.clientUuid);
        setLeads((prev) => prev.map((l) => (
          l.clientUuid === payload.clientUuid
            ? mapLeadRow({ ...res.lead, salesman_name: session.fullName })
            : l
        )));
      } catch (err) {
        if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 0) {
          removeQueuedLead(payload.clientUuid);
        }
        break;
      }
    }

    setQueuedCount(getQueuedLeads().length);
  }, [session.fullName]);

  useEffect(() => {
    if (online) flushQueue();
  }, [online, flushQueue]);

  useEffect(() => {
    if (!online) return;
    const iv = setInterval(flushQueue, 20000);
    return () => clearInterval(iv);
  }, [online, flushQueue]);

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
        throw err;
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
