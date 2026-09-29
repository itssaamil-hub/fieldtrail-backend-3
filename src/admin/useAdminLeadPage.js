import { useEffect, useMemo, useRef, useState } from "react";
import { api, mapLeadRow } from "../api.js";

const AUTO_REFRESH_MS = 60000;

export default function useAdminLeadPage({
  enabled,
  salesmanId,
  status,
  date,
  search,
  limit = 50,
  refreshKey = "",
}) {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(String(search || "").trim());
  const [refreshVersion, setRefreshVersion] = useState(0);
  const requestVersionRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(String(search || "").trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [salesmanId, status, date, debouncedSearch]);

  useEffect(() => {
    if (!enabled) return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setRefreshVersion((value) => value + 1);
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    const onVisible = () => {
      if (document.visibilityState === "visible") setRefreshVersion((value) => value + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const requestVersion = ++requestVersionRef.current;
    setLoading(true);
    setError("");

    api.adminLeads({
      salesmanId: salesmanId === "all" ? undefined : salesmanId,
      status: status === "all" ? undefined : status,
      date: date || undefined,
      search: debouncedSearch || undefined,
      page,
      limit,
    }).then((result) => {
      if (requestVersion !== requestVersionRef.current) return;
      let mapped = (result?.leads || []).map(mapLeadRow);

      // Compatibility while an older backend is still live: it returns the
      // historical latest-500 shape without pagination metadata. Filter/page
      // that bounded response locally until Render has the new route.
      if (result?.total == null || result?.totalPages == null) {
        const query = debouncedSearch.toLowerCase();
        if (date) mapped = mapped.filter((lead) => lead.createdAt.toISOString().slice(0, 10) === date);
        if (query) {
          mapped = mapped.filter((lead) => [lead.business, lead.owner, lead.phone, lead.subLocation, lead.posName, lead.salesmanName]
            .some((value) => String(value || "").toLowerCase().includes(query)));
        }
        const fallbackTotal = mapped.length;
        const fallbackPages = Math.max(1, Math.ceil(fallbackTotal / limit));
        if (page > fallbackPages) {
          setPage(fallbackPages);
          return;
        }
        setRows(mapped.slice((page - 1) * limit, page * limit));
        setTotal(fallbackTotal);
        setTotalPages(fallbackPages);
        return;
      }

      const nextTotalPages = Math.max(1, Number(result.totalPages) || 1);
      if (page > nextTotalPages) {
        setPage(nextTotalPages);
        return;
      }
      setRows(mapped);
      setTotal(Number(result.total) || 0);
      setTotalPages(nextTotalPages);
    }).catch((err) => {
      if (requestVersion !== requestVersionRef.current) return;
      setError(err?.message || "Couldn't load leads.");
    }).finally(() => {
      if (requestVersion === requestVersionRef.current) setLoading(false);
    });
  }, [enabled, salesmanId, status, date, debouncedSearch, page, limit, refreshKey, refreshVersion]);

  return useMemo(() => ({
    page,
    setPage,
    rows,
    total,
    totalPages,
    loading,
    error,
  }), [page, rows, total, totalPages, loading, error]);
}
