import React, { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { nearestRenewalCountdown } from "../renewalCountdown.js";
import DashboardMonthFilter, { currentIstMonth, periodMonth } from "./DashboardMonthFilter.jsx";
import { loadAdminDashboardMonthMetrics } from "../dashboardComparisons.js";
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

async function fetchCompleteCurrentMonthNegotiation(salesmanId = "all") {
  const rows = [];
  let page = 1;
  let hasNext = true;
  while (hasNext) {
    const params = { status: "negotiation", negotiationPeriod: "month", page, limit: 100 };
    if (salesmanId !== "all") params.salesmanId = salesmanId;
    const result = await api.adminLeads(params);
    rows.push(...(result.leads || []));
    hasNext = result.hasNext === true;
    page += 1;
    if (page > 10000) throw new Error("Negotiation KPI pagination did not terminate safely.");
  }
  return rows.map(mapLeadRow);
}

function DashboardStatCard({ T, label, value, sub, subInline = false, color, icon: IconC, onClick, comparison, comparisonPeriod, periodControl }) {
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
          style={{ color: comparison.pct == null ? T.verified : comparison.pct > 0 ? T.verified : comparison.pct < 0 ? T.danger : T.inkSoft }}
        >
          {comparison.pct == null ? "↑ New" : comparison.pct > 0 ? `↑ ${comparison.pct}%` : comparison.pct < 0 ? `↓ ${Math.abs(comparison.pct)}%` : "— Same"}{" "}
          <span>vs last {comparisonPeriod === "monthly" ? "month" : "week"}</span>
        </div>
      )}
      {periodControl}
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
  const [monthPeriod, setMonthPeriod] = useState("all");
  const [customMonth, setCustomMonth] = useState(currentIstMonth);
  const selectedMonth = periodMonth(monthPeriod, customMonth);
  const [monthData, setMonthData] = useState(null);
  const [monthLoading, setMonthLoading] = useState(false);
  const [monthError, setMonthError] = useState("");

  const refreshComparisons = useCallback(async () => {
    if (!showDashboard) return;
    try {
      const result = await loadAdminDashboardComparisons(dashboardSalesman);
      setComparisonData(result);
    } catch {
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
    if (!showDashboard || !selectedMonth) {
      setMonthData(null);
      setMonthError("");
      setMonthLoading(false);
      return undefined;
    }
    let cancelled = false;
    setMonthData(null);
    setMonthError("");
    setMonthLoading(true);
    loadAdminDashboardMonthMetrics(selectedMonth, dashboardSalesman)
      .then(data => {
        if (!cancelled) setMonthData({ month: data.month, employee: dashboardSalesman, metrics: data.metrics });
      })
      .catch(error => {
        if (!cancelled) {
          setMonthData(null);
          setMonthError(error.message || "Monthly KPI data unavailable");
        }
      })
      .finally(() => { if (!cancelled) setMonthLoading(false); });
    return () => { cancelled = true; };
  }, [showDashboard, selectedMonth, dashboardSalesman, leads]);

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
  const renewalNearest = nearestRenewalCountdown(upcomingRenewals);
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
  const negotiationDealValue = serverMetrics.negotiationValue ?? inNegotiation.reduce((sum, lead) => sum + (Number(lead.dealValue) || 0), 0);
  const monthMetrics = selectedMonth && monthData?.month === selectedMonth
    && monthData?.employee === dashboardSalesman ? monthData.metrics : null;
  const scopedValue = (key, allTimeValue) =>
    selectedMonth ? (monthMetrics ? monthMetrics[key] : "—") : allTimeValue;
  const monthlyHint = monthLoading ? "Loading…" : monthError ? "Unavailable" : "—";
  const conversationKpi = scopedValue("conversation", conversationValue);
  const hotKpi = scopedValue("hot", hotTodayValue);
  const negotiationKpiCount = scopedValue("negotiation", negotiationValue);
  const negotiationKpiValue = scopedValue("negotiationValue", negotiationDealValue);
  const negotiationKpiSub = selectedMonth && !monthMetrics ? monthlyHint : fmtMoney(negotiationKpiValue);
  const totalValue = scopedValue("total", serverMetrics.total ?? dashboardLeads.length);
  const wonValue = scopedValue("won", serverMetrics.won ?? converted);
  const wonDealValue = scopedValue("wonValue", serverMetrics.wonValue ?? convertedValue);
  const wonSub = selectedMonth && !monthMetrics ? monthlyHint : fmtMoney(wonDealValue);
  const monthLabel = selectedMonth
    ? new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(selectedMonth + "-01T00:00:00Z"))
    : "";

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const adminName = (getSession()?.fullName || getSession()?.full_name || getSession()?.name || "Admin").split(/\s+/)[0];

  const openMonthlyDrilldown = async (status, label) => {
    if (!selectedMonth || !monthMetrics) return;
    try {
      setConversationError("");
      const rows = [];
      let page = 1;
      let hasNext = true;
      while (hasNext) {
        const params = { dashboardMonth: selectedMonth, page, limit: 100 };
        if (status) params.status = status;
        if (dashboardSalesman !== "all") params.salesmanId = dashboardSalesman;
        const response = await api.adminLeads(params);
        rows.push(...(response.leads || []));
        hasNext = response.hasNext === true;
        if (++page > 10000) throw new Error("Monthly deal pagination did not finish.");
      }
      onOpenStatLeads({ title: label + " · " + monthLabel, leads: rows.map(mapLeadRow) });
    } catch (error) {
      setConversationError(error.message || "Couldn't load the selected month's deals.");
    }
  };

  const openConversationLeads = async () => {
    if (selectedMonth) return openMonthlyDrilldown("conversation", "Conversation");
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

  const openNegotiationLeads = () => selectedMonth
    ? openMonthlyDrilldown("negotiation", "In Negotiation")
    : onOpenStatLeads({ title: "In Negotiation", leads: inNegotiation });

  const openWonLeads = async () => {
    if (selectedMonth) return openMonthlyDrilldown("won", "Won Leads");
    try {
      setConversationError("");
      const wonLeads = await fetchCompleteCurrentWonLeads(dashboardSalesman);
      onOpenStatLeads({ title: "Won Leads", leads: wonLeads });
    } catch (error) {
      setConversationError(error.message || "Couldn't load Won leads.");
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
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <select aria-label="Dashboard employee desktop" value={dashboardSalesman} onChange={(e) => setDashboardSalesman(e.target.value)} style={{ minWidth: 128, height: 34, padding: "5px 30px 5px 10px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, background: "#fff", border: `1px solid ${T.line}`, color: T.ink }}>
            <option value="all">👥 All Team</option>
            {salesmen.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <DashboardMonthFilter T={T} employee={dashboardSalesman} onEmployeeChange={setDashboardSalesman} salesmen={salesmen} period={monthPeriod} onPeriodChange={setMonthPeriod} customMonth={customMonth} onCustomMonthChange={setCustomMonth} />
          </div>
        </div>
      )}
      {phone && (
        <div id="engage-admin-mobile-dashboard-utility" className="engage-admin-mobile-dashboard-utility">
          <div className="engage-admin-mobile-greeting">{greeting}, {adminName} 👋</div>
          <div className="engage-admin-mobile-team-slot">
            <DashboardMonthFilter T={T} phone employee={dashboardSalesman} onEmployeeChange={setDashboardSalesman} salesmen={salesmen} period={monthPeriod} onPeriodChange={setMonthPeriod} customMonth={customMonth} onCustomMonthChange={setCustomMonth} />
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <DashboardStatCard T={T} label="Total Employees" value={salesmen.length} sub={<span style={{ color: T.verified }}>{activeSalesmen} active now</span>} icon={Contact2} color="#64748B" onClick={phone ? onShowTeamActivity : undefined} />
        <DashboardStatCard T={T} label="Conversation" value={conversationKpi} comparison={selectedMonth ? null : comparisons.conversation} comparisonPeriod={comparisonPeriod} icon={MessageSquare} color={T.route} onClick={openConversationLeads} />
        <DashboardStatCard T={T} label="Leads Today" value={leadsTodayValue} comparison={comparisons.leadsToday} comparisonPeriod={comparisonPeriod} icon={TargetIcon} color="#3B82F6" onClick={() => onOpenStatLeads({ title: "Leads Today", leads: todayLeads })} />
        <DashboardStatCard T={T} label={selectedMonth ? "Hot Leads" : <>Hot Leads <span style={{ fontSize: 8.5, opacity: 0.65 }}>TODAY</span></>} value={hotKpi} icon={Flame} comparison={selectedMonth ? null : comparisons.hotToday} comparisonPeriod={comparisonPeriod} color={T.danger} onClick={selectedMonth ? () => openMonthlyDrilldown("hot", "Hot Leads") : () => onOpenStatLeads({ title: "Hot Leads Today", leads: hotLeadsToday })} />
        <DashboardStatCard T={T} label="In Negotiation" value={negotiationKpiCount} sub={negotiationKpiSub} subInline comparison={selectedMonth ? null : comparisons.negotiation} comparisonPeriod={comparisonPeriod} icon={Handshake} color="#8B5CF6" onClick={openNegotiationLeads} />
        <DashboardStatCard T={T} label="Total Leads" value={totalValue} comparison={selectedMonth ? null : comparisons.total} comparisonPeriod={comparisonPeriod} icon={Contact2} color="#0891B2" onClick={selectedMonth ? () => openMonthlyDrilldown(null, "Total Leads") : undefined} />
        <DashboardStatCard T={T} label="Won" value={wonValue} sub={wonSub} subInline comparison={selectedMonth ? null : comparisons.won} comparisonPeriod={comparisonPeriod} icon={CheckCircle2} color={T.verified} onClick={openWonLeads} />
        <DashboardStatCard T={T} label="Tasks" value={adminPendingTasks ?? 0} sub="pending" icon={List} color="#145C5D" />
        <DashboardStatCard T={T} label="Upcoming Follow-up" value={upcomingFollowUps.length} icon={CalendarClock} color={T.warn} onClick={() => onOpenStatLeads({ title: "Upcoming Follow-ups", leads: upcomingFollowUps })} />
        <DashboardStatCard T={T} label="Renewals Due" sub={renewalNearest || "next 30 days"} value={upcomingRenewals.length} icon={RefreshCw} color={T.accent} onClick={() => onOpenStatLeads({ title: "Renewals Due (Next 30 Days)", leads: upcomingRenewals })} />
      </div>
      {!phone && <AdminActivityOverview salesmen={salesmen} salesmanId={dashboardSalesman} />}
      {phone && <AdminMobileLeadTrend leads={dashboardLeads} />}
      {(conversationError || monthError) && <p role="alert" style={{ color: T.danger }}>{conversationError || monthError}</p>}
      <div style={{ display: "none" }} aria-hidden="true"><TasksEntry onPendingChange={setAdminPendingTasks} /></div>
    </>
  );
}
