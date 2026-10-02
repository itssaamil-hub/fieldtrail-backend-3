import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  ApiError,
  getSession,
  mapLeadRow,
} from "./api.js";

const PAGE_SIZE = 50;

function fallbackSummary(leads) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const next30 = new Date(today); next30.setDate(next30.getDate() + 30);
  const month = now.getMonth(), year = now.getFullYear();
  const nextMonth = (month + 1) % 12;
  const monthNames = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  const renewalMonths = new Set([monthNames[month], monthNames[nextMonth]]);
  const result = { total: leads.length, today: 0, month: 0, hot: 0, conversation: 0, negotiation: 0, won: 0, pending: 0, wonValue: 0, renewalsDue: 0 };
  for (const lead of leads) {
    const created = lead.createdAt instanceof Date ? lead.createdAt : new Date(lead.createdAt);
    if (!Number.isNaN(created.getTime())) {
      if (created >= today) result.today += 1;
      if (created.getFullYear() === year && created.getMonth() === month) result.month += 1;
    }
    if (lead.status === "hot") result.hot += 1;
    if (lead.status === "conversation") result.conversation += 1;
    if (lead.status === "negotiation") result.negotiation += 1;
    if (lead.status === "won") { result.won += 1; result.wonValue += Number(lead.dealValue || 0); }
    if (!["won", "lost"].includes(lead.status)) result.pending += 1;
    if (lead.renewalDate) {
      const renewal = new Date(lead.renewalDate);
      if (!Number.isNaN(renewal.getTime()) && renewal >= today && renewal <= next30) result.renewalsDue += 1;
    } else if (lead.renewalMonth && renewalMonths.has(String(lead.renewalMonth).toLowerCase())) {
      result.renewalsDue += 1;
    }
  }
  return result;
}

function mergeUnique(current, incoming) {
  const seen = new Set();
  const merged = [];
  for (const lead of [...current, ...incoming]) {
    const key = lead.id || lead.clientUuid;
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    merged.push(lead);
  }
  return merged;
}

export default function useSalesmanLeads({ session, setLoadError }) {
  const [leads, setLeads] = useState([]);
  const [leadSummary, setLeadSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadedPage, setLoadedPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const updateFlights = useRef(new Set());
  const loadMoreFlightRef = useRef(null);
  const mountedRef = useRef(true);
  const refreshSummary = useCallback(async (fallbackLeads = null) => {
    try {
      const summary = await api.salesmanLeadSummary(session.id);
      if (mountedRef.current && getSession()?.id === session.id) setLeadSummary(summary);
      return summary;
    } catch {
      if (mountedRef.current && fallbackLeads) setLeadSummary(fallbackSummary(fallbackLeads));
      return null;
    }
  }, [session.id]);

  const loadLeads = useCallback(async () => {
    try {
      const res = await api.salesmanLeads({ page: 1, limit: PAGE_SIZE }, session.id);
      if (!mountedRef.current || getSession()?.id !== session.id) return;
      const mapped = (res.leads || []).map((r) => mapLeadRow({ ...r, salesman_name: session.fullName }));
      setLeads(mapped);
      setLoadedPage(1);
      setTotal(Number.isFinite(Number(res.total)) ? Number(res.total) : mapped.length);
      setTotalPages(Math.max(1, Number(res.totalPages) || 1));
      setLoadError("");
      refreshSummary(mapped);
    } catch (err) {
      if (mountedRef.current) setLoadError(err instanceof ApiError ? err.message : "Couldn't load your leads.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [session.id, session.fullName, setLoadError, refreshSummary]);

  useEffect(() => {
    mountedRef.current = true;
    loadLeads();
    return () => { mountedRef.current = false; };
  }, [loadLeads]);

  const loadMoreLeads = useCallback(() => {
    if (loadMoreFlightRef.current || loadedPage >= totalPages) return loadMoreFlightRef.current || Promise.resolve();
    const nextPage = loadedPage + 1;
    setLoadingMore(true);
    const request = api.salesmanLeads({ page: nextPage, limit: PAGE_SIZE }, session.id)
      .then((res) => {
        if (!mountedRef.current || getSession()?.id !== session.id) return;
        const mapped = (res.leads || []).map((r) => mapLeadRow({ ...r, salesman_name: session.fullName }));
        setLeads((prev) => mergeUnique(prev, mapped));
        setLoadedPage(Number(res.page) || nextPage);
        if (Number.isFinite(Number(res.total))) setTotal(Number(res.total));
        if (Number.isFinite(Number(res.totalPages))) setTotalPages(Math.max(1, Number(res.totalPages)));
      })
      .catch((err) => {
        if (mountedRef.current) setLoadError(err instanceof ApiError ? err.message : "Couldn't load more leads.");
      })
      .finally(() => {
        if (loadMoreFlightRef.current === request) loadMoreFlightRef.current = null;
        if (mountedRef.current) setLoadingMore(false);
      });
    loadMoreFlightRef.current = request;
    return request;
  }, [loadedPage, totalPages, session.id, session.fullName, setLoadError]);

  const handleAddLead = async payload => {
    try {
      const res = await api.salesmanCreateLead(payload, session.id);
      const mapped = mapLeadRow({ ...res.lead, salesman_name: session.fullName });
      if (mountedRef.current && getSession()?.id === session.id) {
        setLeads(prev => mergeUnique([mapped], prev));
        if (!res.deduped) setTotal(value => value + 1);
        setLoadError("");
        refreshSummary();
      }
      return { ok: true, lead: mapped };
    } catch (err) {
      return { ok: false, error: err?.message || "The deal was not saved. Check your connection and try again." };
    }
  };

  const saveLeadUpdate = async (id, payload) => {
    if (updateFlights.current.has(id)) throw new Error("A save is already in progress for this deal. Please wait.");
    updateFlights.current.add(id);
    try {
      const result = await api.salesmanUpdateLead(id, payload, session.id);
      if (mountedRef.current && getSession()?.id === session.id) {
        const saved = mapLeadRow({ ...result.lead, salesman_name: session.fullName });
        setLeads(prev => prev.map(lead => lead.id === id ? saved : lead));
        setLoadError("");
        refreshSummary();
      }
      return result;
    } catch (err) {
      if (mountedRef.current && getSession()?.id === session.id) setLoadError(err.message || "The deal could not be saved. Please try again.");
      throw err;
    } finally { updateFlights.current.delete(id); }
  };
  const handleUpdateLeadStatus = (id, status) => saveLeadUpdate(id, { status });
  const handleUpdateLeadDetails = (id, payload) => saveLeadUpdate(id, payload);

  return {
    leads,
    leadSummary,
    loading,
    loadingMore,
    totalLeadCount: total,
    hasMoreLeads: loadedPage < totalPages,
    loadLeads,
    loadMoreLeads,
    handleAddLead,
    handleUpdateLeadStatus,
    handleUpdateLeadDetails,
  };
}
