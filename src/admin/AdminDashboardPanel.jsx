import React, { lazy, Suspense, useEffect, useState } from "react";
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
import { api, getSession, mapLeadRow } from "../api.js";
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

function DashboardStatCard({ T, label, value, sub, color, icon: IconC, onClick, comparison, comparisonPeriod }) {
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
      <div className="engage-dashboard-stat-value engage-db-value">{value}</div>
      {sub && <div className="engage-dashboard-stat-sub">{sub}</div>}
      {comparison && (
        <div
          className="engage-dashboard-stat-comparison"
          style={{ color: comparison.pct == null ? T.verified : comparison.pct > 0 ? T.verified : comparison.pct < 0 ? T.danger : T.inkSoft }}
        >
          {comparison.pct == null ? "↑ New" : comparison.pct > 0 ? `↑ ${comparison.pct}%` : comparison.pct < 0 ? `↓ ${Math.abs(comparison.pct)}%` : "— Same"}{" "}
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
    comparisonFor,
    dailyComparisonFor,
    getDashboardDisplaySettings,
  } = shared;
  const [dashboardSalesman, setDashboardSalesman] = useState("all");
  const [dashboardDisplay, setDashboardDisplay] = useState(getDashboardDisplaySettings);
  const [conversationError, setConversationError] = useState("");
  const [adminPendingTasks, setAdminPendingTasks] = useState(null);

  useEffect(() => {
    const sync = () => setDashboardDisplay(getDashboardDisplaySettings());
    window.addEventListener("engage-display-settings", sync);
    return () => window.removeEventListener("engage-display-settings", sync);
  }, [getDashboardDisplaySettings]);

  if (!showDashboard) return null;

  const dashboardLeads = dashboardSalesman === "all" ? leads : leads.filter((l) => l.salesmanId === dashboardSalesman);
  const todayLeads = dashboardLeads.filter((l) => isToday(l.createdAt));
  const hotLeadsToday = todayLeads.filter((l) => l.status === "hot");
  const inNegotiation = dashboardLeads.filter((l) => l.status === "negotiation");
  const upcomingRenewals = dashboardLeads.filter((l) =>
    (l.renewalDate && isWithinDays(new Date(l.renewalDate), 30)) ||
    (!l.renewalDate && isUpcomingRenewalMonth(l.renewalMonth))
  );
  const converted = dashboardLeads.filter((l) => l.status === "won").length;
  const convertedValue = dashboardLeads.filter((l) => l.status === "won" && l.dealValue != null).reduce((sum, l) => sum + l.dealValue, 0);
  const upcomingFollowUps = dashboardLeads.filter((l) => l.nextFollowUpDate && new Date(l.nextFollowUpDate) >= new Date(new Date().toDateString()));
  const activeSalesmen = salesmen.filter((s) => s.status === "online").length;
  const comparisonPeriod = dashboardDisplay.comparisonPeriod || "weekly";
  const comparisonsEnabled = dashboardDisplay.showComparisons !== false;
  const dashboardComparison = comparisonsEnabled ? comparisonFor(dashboardLeads, comparisonPeriod) : null;
  const conversationComparison = comparisonsEnabled ? comparisonFor(dashboardLeads, comparisonPeriod, (l) => l.status === "conversation") : null;
  const leadsTodayComparison = comparisonsEnabled ? dailyComparisonFor(dashboardLeads, comparisonPeriod) : null;
  const hotComparison = comparisonsEnabled ? dailyComparisonFor(dashboardLeads, comparisonPeriod, (l) => l.status === "hot") : null;
  const negotiationComparison = comparisonsEnabled ? comparisonFor(dashboardLeads, comparisonPeriod, (l) => l.status === "negotiation") : null;
  const wonComparison = comparisonsEnabled ? comparisonFor(dashboardLeads, comparisonPeriod, (l) => l.status === "won") : null;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const adminName = (getSession()?.fullName || getSession()?.full_name || getSession()?.name || "Admin").split(/\s+/)[0];

  const openConversationLeads = async () => {
    try {
      setConversationError("");
      const result = await api.adminLeads({ status: "conversation" });
      onOpenStatLeads({
        title: conversationCount > 500 ? "Conversation Leads · Latest 500" : "Conversation Leads",
        leads: (result.leads || []).map(mapLeadRow),
      });
    } catch (error) {
      setConversationError(error.message || "Couldn't load conversation leads.");
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
        <DashboardStatCard T={T} label="Conversation" value={conversationCount ?? "—"} comparison={conversationComparison} comparisonPeriod={comparisonPeriod} icon={MessageSquare} color={T.route} onClick={openConversationLeads} />
        <DashboardStatCard T={T} label="Leads Today" value={todayLeads.length} comparison={leadsTodayComparison} comparisonPeriod={comparisonPeriod} icon={TargetIcon} color="#3B82F6" onClick={() => onOpenStatLeads({ title: "Leads Today", leads: todayLeads })} />
        <DashboardStatCard T={T} label={<>Hot Leads <span style={{ fontSize: 8.5, opacity: 0.65 }}>TODAY</span></>} value={hotLeadsToday.length} icon={Flame} comparison={hotComparison} comparisonPeriod={comparisonPeriod} color={T.danger} onClick={() => onOpenStatLeads({ title: "Hot Leads Today", leads: hotLeadsToday })} />
        <DashboardStatCard T={T} label="In Negotiation" value={inNegotiation.length} comparison={negotiationComparison} comparisonPeriod={comparisonPeriod} icon={Handshake} color="#8B5CF6" onClick={() => onOpenStatLeads({ title: "In Negotiation", leads: inNegotiation })} />
        <DashboardStatCard T={T} label="Total Leads" value={dashboardLeads.length} comparison={dashboardComparison} comparisonPeriod={comparisonPeriod} icon={Contact2} color="#0891B2" />
        <DashboardStatCard T={T} label="Won" value={converted} sub={fmtMoney(convertedValue)} comparison={wonComparison} comparisonPeriod={comparisonPeriod} icon={CheckCircle2} color={T.verified} onClick={() => onOpenStatLeads({ title: "Won Leads", leads: dashboardLeads.filter((l) => l.status === "won") })} />
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
