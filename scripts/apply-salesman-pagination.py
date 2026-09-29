from pathlib import Path

# api.js: add query-aware salesman leads + summary endpoint.
api_path = Path('src/api.js')
api = api_path.read_text()
old = '  salesmanLeads: () => request("/salesman/leads"),\n  salesmanLead: (id) => request(`/salesman/leads/${id}`),'
new = '''  salesmanLeads: (params = {}) => {
    const entries = Object.entries(params).filter(([, v]) => v != null && v !== "" && v !== "all");
    const qs = new URLSearchParams(entries).toString();
    return request(`/salesman/leads${qs ? `?${qs}` : ""}`);
  },
  salesmanLeadSummary: () => request("/salesman/leads-summary"),
  salesmanLead: (id) => request(`/salesman/leads/${id}`),'''
if old not in api:
    raise SystemExit('salesmanLeads api marker not found')
api_path.write_text(api.replace(old, new, 1))

# Replace the hook with a bounded first page + progressive load-more implementation.
hook_path = Path('src/useSalesmanLeads.js')
hook_path.write_text(r'''import { useCallback, useEffect, useRef, useState } from "react";
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

export default function useSalesmanLeads({ online, session, setLoadError, makeQueuedLead }) {
  const [leads, setLeads] = useState([]);
  const [leadSummary, setLeadSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadedPage, setLoadedPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [queuedCount, setQueuedCount] = useState(getQueuedLeads().length);
  const queueFlightRef = useRef(null);
  const loadMoreFlightRef = useRef(null);
  const mountedRef = useRef(true);

  const refreshSummary = useCallback(async (fallbackLeads = null) => {
    try {
      const summary = await api.salesmanLeadSummary();
      if (mountedRef.current) setLeadSummary(summary);
      return summary;
    } catch {
      if (mountedRef.current && fallbackLeads) setLeadSummary(fallbackSummary(fallbackLeads));
      return null;
    }
  }, []);

  const loadLeads = useCallback(async () => {
    try {
      const res = await api.salesmanLeads({ page: 1, limit: PAGE_SIZE });
      if (!mountedRef.current) return;
      const mapped = (res.leads || []).map((r) => mapLeadRow({ ...r, salesman_name: session.fullName }));
      const queued = getQueuedLeads().map((payload) => ({ ...makeQueuedLead(payload), syncStatus: "queued" }));
      const next = mergeUnique(queued, mapped);
      setLeads(next);
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
  }, [session.fullName, setLoadError, makeQueuedLead, refreshSummary]);

  useEffect(() => {
    mountedRef.current = true;
    loadLeads();
    return () => { mountedRef.current = false; };
  }, [loadLeads]);

  const loadMoreLeads = useCallback(() => {
    if (loadMoreFlightRef.current || loadedPage >= totalPages) return loadMoreFlightRef.current || Promise.resolve();
    const nextPage = loadedPage + 1;
    setLoadingMore(true);
    const request = api.salesmanLeads({ page: nextPage, limit: PAGE_SIZE })
      .then((res) => {
        if (!mountedRef.current) return;
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
  }, [loadedPage, totalPages, session.fullName, setLoadError]);

  const flushQueue = useCallback(() => {
    if (queueFlightRef.current) return queueFlightRef.current;
    const queue = getQueuedLeads();
    if (queue.length === 0) {
      if (mountedRef.current) setQueuedCount(0);
      return Promise.resolve();
    }

    const request = (async () => {
      let synced = 0;
      for (const payload of queue) {
        try {
          const res = await api.salesmanCreateLead(payload);
          removeQueuedLead(payload.clientUuid);
          synced += 1;
          if (mountedRef.current) {
            setLeads((prev) => prev.map((l) => (
              l.clientUuid === payload.clientUuid
                ? mapLeadRow({ ...res.lead, salesman_name: session.fullName })
                : l
            )));
          }
        } catch (err) {
          if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 0) removeQueuedLead(payload.clientUuid);
          break;
        }
      }
      if (mountedRef.current) {
        if (synced) setTotal((value) => value + synced);
        setQueuedCount(getQueuedLeads().length);
        refreshSummary();
      }
    })().finally(() => {
      if (queueFlightRef.current === request) queueFlightRef.current = null;
    });

    queueFlightRef.current = request;
    return request;
  }, [session.fullName, refreshSummary]);

  useEffect(() => {
    if (online && queuedCount > 0 && document.visibilityState === "visible") flushQueue();
  }, [online, queuedCount, flushQueue]);

  useEffect(() => {
    if (!online || queuedCount === 0) return undefined;
    let timerId = null;
    let stopped = false;
    const schedule = () => {
      if (stopped || getQueuedLeads().length === 0) return;
      timerId = window.setTimeout(run, QUEUE_RETRY_BASE_MS + Math.floor(Math.random() * QUEUE_RETRY_JITTER_MS));
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
        setLeads((prev) => mergeUnique([mapped], prev));
        setTotal((value) => value + 1);
        refreshSummary();
        return { ok: true, lead: mapped };
      } catch (err) {
        if (!(err instanceof ApiError) || err.status === 0) {
          pushQueuedLead(payload);
          setQueuedCount(getQueuedLeads().length);
          const queued = { ...makeQueuedLead(payload), syncStatus: "queued" };
          setLeads((prev) => mergeUnique([queued], prev));
          return { ok: true, lead: queued };
        }
        return { ok: false, error: err.message };
      }
    }

    pushQueuedLead(payload);
    setQueuedCount(getQueuedLeads().length);
    const queued = { ...makeQueuedLead(payload), syncStatus: "queued" };
    setLeads((prev) => mergeUnique([queued], prev));
    return { ok: true, lead: queued };
  };

  const handleUpdateLeadStatus = async (id, status) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    try {
      await api.salesmanUpdateLead(id, { status });
      refreshSummary();
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
      nextFollowUpDate: payload.nextFollowUpDate ?? l.nextFollowUpDate,
      owner: payload.contactName,
      phone: payload.phone,
      notes: payload.notes,
      dealValue: payload.dealValue,
    } : l)));
    try {
      await api.salesmanUpdateLead(id, payload);
      refreshSummary();
    } catch {
      // Keep the optimistic value; later data refresh reconciles it.
    }
  };

  return {
    leads,
    leadSummary,
    loading,
    loadingMore,
    queuedCount,
    totalLeadCount: total + queuedCount,
    hasMoreLeads: loadedPage < totalPages,
    loadLeads,
    loadMoreLeads,
    handleAddLead,
    handleUpdateLeadStatus,
    handleUpdateLeadDetails,
  };
}
''')

# SalesmanView: accurate server summary for KPI cards + progressive list loading.
view_path = Path('src/salesman/SalesmanView.jsx')
view = view_path.read_text()
old_sig = 'export default function SalesmanView({ notificationLead, session, leads, dayStarted, allowLeadWithoutStartDay, onToggleDay, togglingDay, justToggledDay, onAddLead, onUpdateLeadStatus, onUpdateLeadDetails, online, gpsStatus, queuedCount, loadError, messages, onMarkMessageRead, onDeleteMessage, onReplyMessage, employeeRepliesEnabled = true, dailyTarget, monthlyTarget, page, shared }) {'
new_sig = 'export default function SalesmanView({ notificationLead, session, leads, leadSummary, hasMoreLeads, loadMoreLeads, loadingMoreLeads, totalLeadCount, dayStarted, allowLeadWithoutStartDay, onToggleDay, togglingDay, justToggledDay, onAddLead, onUpdateLeadStatus, onUpdateLeadDetails, online, gpsStatus, queuedCount, loadError, messages, onMarkMessageRead, onDeleteMessage, onReplyMessage, employeeRepliesEnabled = true, dailyTarget, monthlyTarget, page, shared }) {'
if old_sig not in view: raise SystemExit('SalesmanView signature not found')
view = view.replace(old_sig, new_sig, 1)
marker = '  const target = dailyTarget || 8;\n  const monthTarget = monthlyTarget || 200;'
replacement = '''  const target = dailyTarget || 8;
  const monthTarget = monthlyTarget || 200;
  const todayCount = leadSummary?.today ?? todayLeads.length;
  const monthCount = leadSummary?.month ?? monthLeads.length;
  const hotCount = leadSummary?.hot ?? allHotLeads.length;
  const conversationCount = leadSummary?.conversation ?? inConversation.length;
  const negotiationCount = leadSummary?.negotiation ?? inNegotiation.length;
  const wonCount = leadSummary?.won ?? converted;
  const wonValue = leadSummary?.wonValue ?? convertedValue;
  const renewalCount = leadSummary?.renewalsDue ?? upcomingRenewals.length;
  const leadPagingProps = { hasMore: hasMoreLeads, onLoadMore: loadMoreLeads, loadingMore: loadingMoreLeads, totalCount: totalLeadCount };'''
if marker not in view: raise SystemExit('SalesmanView target marker not found')
view = view.replace(marker, replacement, 1)
for old, new in [
  ('<StatCard label="Today" value={todayLeads.length}', '<StatCard label="Today" value={todayCount}'),
  ('<StatCard label="Hot" value={allHotLeads.length}', '<StatCard label="Hot" value={hotCount}'),
  ('<StatCard label="Conversation" value={inConversation.length}', '<StatCard label="Conversation" value={conversationCount}'),
  ('<StatCard label="Negotiation" value={inNegotiation.length}', '<StatCard label="Negotiation" value={negotiationCount}'),
  ('<StatCard label="Won" value={converted} sub={convertedValue > 0 ? fmtMoney(convertedValue) : undefined}', '<StatCard label="Won" value={wonCount} sub={wonValue > 0 ? fmtMoney(wonValue) : undefined}'),
  ('<StatCard label="Renewals" value={upcomingRenewals.length}', '<StatCard label="Renewals" value={renewalCount}'),
  ('{Math.min(todayLeads.length, target)} / {target}', '{Math.min(todayCount, target)} / {target}'),
  ('${Math.min(100, (todayLeads.length / target) * 100)}%', '${Math.min(100, (todayCount / target) * 100)}%'),
  ('{monthLeads.length} / {monthTarget}', '{monthCount} / {monthTarget}'),
  ('${Math.min(100, (monthLeads.length / monthTarget) * 100)}%', '${Math.min(100, (monthCount / monthTarget) * 100)}%'),
  ('{monthLeads.length >= monthTarget ? "🎉 Target reached!" : `${monthTarget - monthLeads.length} more to hit this month\'s target`}', '{monthCount >= monthTarget ? "🎉 Target reached!" : `${monthTarget - monthCount} more to hit this month\'s target`}'),
]:
    if old not in view: raise SystemExit(f'SalesmanView marker missing: {old[:50]}')
    view = view.replace(old, new, 1)
view = view.replace('<MyLeadsModal', '<MyLeadsModal {...leadPagingProps}')
report_marker = '  return (\n    <div className={phone && page !== "reports" ? "engage-admin-mobile-content" : undefined}'
report_effect = '''  useEffect(() => {
    if (page === "reports" && hasMoreLeads && !loadingMoreLeads) loadMoreLeads?.();
  }, [page, hasMoreLeads, loadingMoreLeads, loadMoreLeads, leads.length]);

  return (
    <div className={phone && page !== "reports" ? "engage-admin-mobile-content" : undefined}'''
if report_marker not in view: raise SystemExit('SalesmanView return marker not found')
view = view.replace(report_marker, report_effect, 1)
view_path.write_text(view)

# App.jsx: add load-more support to shared MyLeadsModal and pass hook pagination props.
app_path = Path('src/App.jsx')
app = app_path.read_text()
old_modal = 'function MyLeadsModal({ leads, onClose, onSelectLead, title = "My Leads", allowDateFilter = false, embedded = false, employeeMobile = false }) {'
new_modal = 'function MyLeadsModal({ leads, onClose, onSelectLead, title = "My Leads", allowDateFilter = false, embedded = false, employeeMobile = false, hasMore = false, onLoadMore, loadingMore = false, totalCount = null }) {'
if old_modal not in app: raise SystemExit('MyLeadsModal signature not found')
app = app.replace(old_modal, new_modal, 1)
old_tail = '''      </div>
      {briefLead && <LeadBriefPopup key={briefLead.id} lead={briefLead} buildBrief={buildLeadBrief} onClose={() => setBriefLead(null)} />}
    </Frame>'''
new_tail = '''      </div>
      {hasMore && onLoadMore && (
        <button type="button" disabled={loadingMore} onClick={onLoadMore} style={{ width:"100%", marginTop:12, padding:"10px 12px", borderRadius:9, border:`1px solid ${T.line}`, background:"#fff", color:T.route, fontWeight:800, cursor:loadingMore?"default":"pointer", opacity:loadingMore?.65:1 }}>
          {loadingMore ? "Loading more…" : `Load more leads${totalCount != null ? ` · ${Math.max(0, totalCount - leads.length)} remaining` : ""}`}
        </button>
      )}
      {briefLead && <LeadBriefPopup key={briefLead.id} lead={briefLead} buildBrief={buildLeadBrief} onClose={() => setBriefLead(null)} />}
    </Frame>'''
if old_tail not in app: raise SystemExit('MyLeadsModal tail not found')
app = app.replace(old_tail, new_tail, 1)
old_destructure = '''  const {
    leads,
    loading,
    queuedCount,
    handleAddLead,
    handleUpdateLeadStatus,
    handleUpdateLeadDetails,
  } = useSalesmanLeads({'''
new_destructure = '''  const {
    leads,
    leadSummary,
    loading,
    loadingMore,
    queuedCount,
    totalLeadCount,
    hasMoreLeads,
    loadMoreLeads,
    handleAddLead,
    handleUpdateLeadStatus,
    handleUpdateLeadDetails,
  } = useSalesmanLeads({'''
if old_destructure not in app: raise SystemExit('Salesman hook destructure not found')
app = app.replace(old_destructure, new_destructure, 1)
old_props = '''      leads={leads}
      dayStarted={dayStarted}'''
new_props = '''      leads={leads}
      leadSummary={leadSummary}
      hasMoreLeads={hasMoreLeads}
      loadMoreLeads={loadMoreLeads}
      loadingMoreLeads={loadingMore}
      totalLeadCount={totalLeadCount}
      dayStarted={dayStarted}'''
if old_props not in app: raise SystemExit('SalesmanView props marker not found')
app = app.replace(old_props, new_props, 1)
app_path.write_text(app)
print('frontend salesman pagination wired')
