import React, { lazy, Suspense, useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Contact2,
  Flame,
  Handshake,
  List,
  MessageSquare,
  RefreshCw,
  Target as TargetIcon,
} from "lucide-react";
import { api, getApiBase, getSession, mapLeadRow } from "../api.js";
import { loadAdminDashboardComparisons } from "../dashboardComparisons.js";
import AdminActivityOverview from "../AdminActivityOverview.jsx";
import {
  ADMIN_WON_PERIOD_CHANGE_EVENT,
  adminWonScopeMetrics,
  readAdminWonPeriod,
} from "../lead/wonPeriod.js";

const lazyNamed = (loader, exportName) => {
  const LazyComponent = lazy(() => loader().then((mod) => ({ default: mod[exportName] })));
  return function LazyFeature(props) {
    return (
      <Suspense fallback={null}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
};

const TasksEntry = lazyNamed(() => import("../Tasks.jsx"), "TasksEntry");
const AdminMobileLeadTrend = lazyNamed(() => import("../AdminMobileEnhancements.jsx"), "AdminMobileLeadTrend");

async function fetchCanonicalWonDate(leadId) {
  const base = getApiBase();
  const token = getSession()?.token;
  if (!base || !token) throw new Error("Won Date is unavailable right now.");
  const response = await fetch(`${base}/admin/leads/${encodeURIComponent(leadId)}/won-date`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  let data = null;
  try { data = await response.json(); } catch { /* handled below */ }
  if (!response.ok) throw new Error(data?.error || "Couldn't load Won Date.");
  return data?.wonDate || null;
}

async function fetchCompleteCurrentWonLeads(salesmanId = "all") {
  const rows = [];
  let page = 1;
  let hasNext = true;
  while (hasNext) {
    const params = { status: "won", page, limit: 100 };
    if (salesmanId !== "all") params.salesmanId = salesmanId;
    const result = await api.adminLeads(params);
    rows.push(...(result.leads || []));
    hasNext = result.hasNext === true;
    page += 1;
    if (page > 10000) throw new Error("Won deals pagination did not terminate safely.");
  }

  const mapped = rows.map(mapLeadRow);
  const missing = mapped.filter((lead) => !lead.wonDate);
  if (!missing.length) return mapped;

  const resolved = new Map();
  for (let start = 0; start < missing.length; start += 8) {
    const batch = missing.slice(start, start + 8);
    const results = await Promise.all(batch.map(async (lead) => [lead.id, await fetchCanonicalWonDate(lead.id)]));
    results.forEach(([id, wonDate]) => resolved.set(id, wonDate));
  }

  return mapped.map((lead) => resolved.has(lead.id) ? { ...lead, wonDate: resolved.get(lead.id) } : lead);
}

function DashboardStatCard({ T, label, value, sub, subInline = false, color, icon: IconC, onClick, comparison, comparisonPeriod }) {
  const c = color || T.ink;
  return (
    <div
      className={`ft-card engage-dashboard-stat${onClick ? " ft-row" : ""}`}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <div className="engage-dashboard-stat-header">
        <div className="engage-dashboard-stat-label">{label}</div>
        {IconC && (
          <div className="engage-dashboard-stat-icon" style={{ background: `${c}14`, color: c }} aria-hidden="true">
            <IconC size={16} />
          </div>
        )}
      </div>
      {subInline ? (
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
          <div className="engage-dashboard-stat-value engage-db-value">{value}</div>
          {sub && <div className="engage-dashboard-stat-sub" style={{ marginTop: 0, textAlign: "right", whiteSpace: "nowrap", fontSize: 11, fontWeight: 700, lineHeight: 1 }}>{sub}</div>}
        </div>
      ) : (
        <>
          <div className="engage-dashboard-stat-value engage-db-value">{value}</div>
          {sub && <div className="engage-dashboard-stat-sub">{sub}</div>}
        </>
      )}
      {comparison && (
        <div
          className="engage-dashboard-stat-comparison"
          style={{ color: comparison.pct > 0 ? T.verified : comparison.pct < 0 ? T.danger : T.inkSoft }}
        >
          {comparison.pct > 0 ? `↑ ${comparison.pct}%` : comparison.pct < 0 ? `↓ ${Math.abs(comparison.pct)}%` : "— Same"}{" "}
          <span>vs last {comparisonPeriod === "monthly" ? "month" : "week"}</span>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboardPanel({
  phone,
  showDashboard,
  salesmen,
  leads,
  conversationCount,
  onShowTeamActivity,
  onOpenStatLeads,
  shared,
}) {
  const {
    T,
    fmtMoney,
    isToday,
    isWithinDays,
    isUpcomingRenewalMonth,
  } = shared;
  const [dashboardSalesman, setDashboardSalesman] = useState("all");
  const [comparisonData, setComparisonData] = useState(null);
  const [conversationError, setConversationError] = useState("");
  const [adminPendingTasks, setAdminPendingTasks] = useState(null);
  const [adminWonPeriod, setAdminWonPeriod] = useState(() => readAdminWonPeriod());
  const [completeWonLeads, setCompleteWonLeads] = useState(null);
  const [wonScopeLoading, setWonScopeLoading] = useState(false);
  const [wonScopeError, setWonScopeError] = useState("");

  const refreshComparisons = useCallback(async () => {
    if (!showDashboard) return;
    try {
      const result = await loadAdminDashboardComparisons(dashboardSalesman);
      setComparisonData(result);
    } catch {
      // The primary dashboard remains usable if the comparison service is unavailable.
      // Never fall back to the old client-side approximation because that can misstate history.
      setComparisonData(null);
    }
  }, [showDashboard, dashboardSalesman]);

  useEffect(() => {
    refreshComparisons();
  }, [refreshComparisons, leads, conversationCount]);

  useEffect(() => {
    const sync = () => refreshComparisons();
    window.addEventListener("engage-display-settings", sync);
    return () => window.removeEventListener("engage-display-settings", sync);
  }, [refreshComparisons]);

  useEffect(() => {
    const syncWonPeriod = (event) => setAdminWonPeriod(event?.detail?.period || readAdminWonPeriod());
    const syncStorage = (event) => {
      if (event.key === "engage:admin-won-period") setAdminWonPeriod(readAdminWonPeriod());
    };
    window.addEventListener(ADMIN_WON_PERIOD_CHANGE_EVENT, syncWonPeriod);
    window.addEventListener("storage", syncStorage);
    return () => {
      window.removeEventListener(ADMIN_WON_PERIOD_CHANGE_EVENT, syncWonPeriod);
      window.removeEventListener("storage", syncStorage);
    };
  }, []);

  const loadCompleteWonScope = useCallback(async () => {
    setWonScopeLoading(true);
    setWonScopeError("");
    try {
      const wonLeads = await fetchCompleteCurrentWonLeads(dashboardSalesman);
      const metrics = adminWonScopeMetrics(wonLeads, "month");
      if (!metrics.ready) throw new Error("Canonical Won Date is missing for one or more Won deals.");
      setCompleteWonLeads(wonLeads);
      return wonLeads;
    } catch (error) {
      setCompleteWonLeads(null);
      setWonScopeError(error.message || "Couldn't verify Won totals.");
      throw error;
    } finally {
      setWonScopeLoading(false);
    }
  }, [dashboardSalesman]);

  useEffect(() => {
    if (!showDashboard || adminWonPeriod !== "month") return undefined;
    let cancelled = false;
    setWonScopeLoading(true);
    setWonScopeError("");
    fetchCompleteCurrentWonLeads(dashboardSalesman)
      .then((wonLeads) => {
        if (cancelled) return;
        const metrics = adminWonScopeMetrics(wonLeads, "month");
        if (!metrics.ready) throw new Error("Canonical Won Date is missing for one or more Won deals.");
        setCompleteWonLeads(wonLeads);
      })
      .catch((error) => {
        if (!cancelled) {
          setCompleteWonLeads(null);
          setWonScopeError(error.message || "Couldn't verify Won totals.");
        }
      })
      .finally(() => { if (!cancelled) setWonScopeLoading(false); });
    return () => { cancelled = true; };
  }, [showDashboard, adminWonPeriod, dashboardSalesman, leads]);

  if (!showDashboard) return null;

  const dashboardLeads = dashboardSalesman === "all" ? leads : leads.filter((l) => l.salesmanId === dashboardSalesman);
  const todayLeads = dashboardLeads.filter((l) => isToday(l.createdAt));
  const hotLeadsToday = todayLeads.filter((l) => l.status === "hot");
  const inConversation = dashboardLeads.filter((l) => l.status === "conversation");
  const inNegotiation = dashboardLeads.filter((l) => l.status === "negotiation");
  const upcomingRenewals = dashboardLeads.filter((l) =>
    (l.renewalDate && isWithinDays(new Date(l.renewalDate), 30)) ||
    (!l.renewalDate && isUpcomingRenewalMonth(l.renewalMonth))
  );
  const converted = dashboardLeads.filter((l) => l.status === "won").length;
  const convertedValue = dashboardLeads.filter((l) => l.status === "won" && l.dealValue != null).reduce((sum, l) => sum + l.dealValue, 0);
  const upcomingFollowUps = dashboardLeads.filter((l) => l.nextFollowUpDate && new Date(l.nextFollowUpDate) >= new Date(new Date().toDateString()));
  const activeSalesmen = salesmen.filter((s) => s.status === "online").length;

  const serverMetrics = comparisonData?.metrics || {};
  const displaySettings = comparisonData?.settings || {};
  const comparisonPeriod = comparisonData?.period || displaySettings.comparisonPeriod || "weekly";
  const comparisonsEnabled = comparisonData && displaySettings.showAdminComparisons !== false;
  const comparisons = comparisonsEnabled ? comparisonData.comparisons || {} : {};

  const conversationValue = serverMetrics.conversation ?? (dashboardSalesman === "all" ? conversationCount : inConversation.length);
  const leadsTodayValue = serverMetrics.leadsToday ?? todayLeads.length;
  const hotTodayValue = serverMetrics.hotToday ?? hotLeadsToday.length;
  const negotiationValue = serverMetrics.negotiation ?? inNegotiation.length;
  const totalValue = serverMetrics.total ?? dashboardLeads.length;
  const monthlyWonMetrics = adminWonPeriod === "month" && completeWonLeads
    ? adminWonScopeMetrics(completeWonLeads, "month")
    : null;
  const wonValue = adminWonPeriod === "month"
    ? (monthlyWonMetrics?.ready ? monthlyWonMetrics.count : "—")
    : (serverMetrics.won ?? converted);
  const wonDealValue = adminWonPeriod === "month"
    ? (monthlyWonMetrics?.ready ? monthlyWonMetrics.value : null)
    : (serverMetrics.wonValue ?? convertedValue);
  const wonSub = adminWonPeriod === "month" && !monthlyWonMetrics?.ready
    ? (wonScopeLoading ? "Loading…" : wonScopeError ? "Unavailable" : "—")
    : fmtMoney(wonDealValue);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const adminName = (getSession()?.fullName || getSession()?.full_name || getSession()?.name || "Admin").split(/\s+/)[0];

  const openConversationLeads = async () => {
    try {
      setConversationError("");
      const params = { status: "conversation" };
      if (dashboardSalesman !== "all") params.salesmanId = dashboardSalesman;
      const result = await api.adminLeads(params);
      onOpenStatLeads({
        title: conversationValue > 500 ? "Conversation Leads · Latest 500" : "Conversation Leads",
        leads: (result.leads || []).map(mapLeadRow),
      });
    } catch (error) {
      setConversationError(error.message || "Couldn't load conversation leads.");
    }
  };

  const openWonLeads = async () => {
    try {
      const wonLeads = await loadCompleteWonScope();
      onOpenStatLeads({ title: "Won Leads", leads: wonLeads });
    } catch {
      // The card already shows Unavailable instead of opening a knowingly incomplete Won view.
    }
  };

  return (
    <>
      {!phone && (
        <div className="engage-dashboard-greeting" style={{ minHeight: 44, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "0 2px", marginBottom: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, lineHeight: 1.2, fontWeight: 700, letterSpacing: "-.25px", color: T.ink }}>
              {greeting}, {adminName} 👋
            </div>
            <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 2 }}>A quick look at what needs your attention today.</div>
          </div>
          <select aria-label="Dashboard employee desktop" value={dashboardSalesman} onChange={(e) => setDashboardSalesman(e.target.value)} style={{ minWidth: 128, height: 34, padding: "5px 30px 5px 10px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, background: "#fff", border: `1px solid ${T.line}`, color: T.ink }}>
            <option value="all">👥 All Team</option>
            {salesmen.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}
      {phone && (
        <div id="engage-admin-mobile-dashboard-utility" className="engage-admin-mobile-dashboard-utility">
          <div className="engage-admin-mobile-greeting">{greeting}, {adminName} 👋</div>
          <div className="engage-admin-mobile-team-slot">
            <select aria-label="Dashboard employee" value={dashboardSalesman} onChange={(e) => setDashboardSalesman(e.target.value)}>
              <option value="all">All Team</option>
              {salesmen.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <DashboardStatCard T={T} label="Total Employees" value={salesmen.length} sub={<span style={{ color: T.verified }}>{activeSalesmen} active now</span>} icon={Contact2} color="#64748B" onClick={phone ? onShowTeamActivity : undefined} />
        <DashboardStatCard T={T} label="Conversation" value={conversationValue ?? "—"} comparison={comparisons.conversation} comparisonPeriod={comparisonPeriod} icon={MessageSquare} color={T.route} onClick={openConversationLeads} />
        <DashboardStatCard T={T} label="Leads Today" value={leadsTodayValue} comparison={comparisons.leadsToday} comparisonPeriod={comparisonPeriod} icon={TargetIcon} color="#3B82F6" onClick={() => onOpenStatLeads({ title: "Leads Today", leads: todayLeads })} />
        <DashboardStatCard T={T} label={<>Hot Leads <span style={{ fontSize: 8.5, opacity: 0.65 }}>TODAY</span></>} value={hotTodayValue} icon={Flame} comparison={comparisons.hotToday} comparisonPeriod={comparisonPeriod} color={T.danger} onClick={() => onOpenStatLeads({ title: "Hot Leads Today", leads: hotLeadsToday })} />
        <DashboardStatCard T={T} label="In Negotiation" value={negotiationValue} comparison={comparisons.negotiation} comparisonPeriod={comparisonPeriod} icon={Handshake} color="#8B5CF6" onClick={() => onOpenStatLeads({ title: "In Negotiation", leads: inNegotiation })} />
        <DashboardStatCard T={T} label="Total Leads" value={totalValue} comparison={comparisons.total} comparisonPeriod={comparisonPeriod} icon={Contact2} color="#0891B2" />
        <DashboardStatCard T={T} label="Won" value={wonValue} sub={wonSub} subInline comparison={comparisons.won} comparisonPeriod={comparisonPeriod} icon={CheckCircle2} color={T.verified} onClick={openWonLeads} />
        <DashboardStatCard T={T} label="Tasks" value={adminPendingTasks ?? 0} sub="pending" icon={List} color="#145C5D" />
        <DashboardStatCard T={T} label="Upcoming Follow-up" value={upcomingFollowUps.length} icon={CalendarClock} color={T.warn} onClick={() => onOpenStatLeads({ title: "Upcoming Follow-ups", leads: upcomingFollowUps })} />
        <DashboardStatCard T={T} label="Renewals Due" sub="next 30 days" value={upcomingRenewals.length} icon={RefreshCw} color={T.accent} onClick={() => onOpenStatLeads({ title: "Renewals Due (Next 30 Days)", leads: upcomingRenewals })} />
      </div>
      {!phone && <AdminActivityOverview salesmen={salesmen} />}
      {phone && <AdminMobileLeadTrend leads={dashboardLeads} />}
      {conversationError && <p role="alert" style={{ color: T.danger }}>{conversationError}</p>}
      <div style={{ display: "none" }} aria-hidden="true"><TasksEntry onPendingChange={setAdminPendingTasks} /></div>
    </>
  );
}
