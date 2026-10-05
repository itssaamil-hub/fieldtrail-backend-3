import React, { lazy, Suspense, useEffect, useState } from "react";
import ExpensesWorkspace from "../ExpensesWorkspace.jsx";
import {
  AlertTriangle,
  CalendarClock,
  Clock,
  Contact2,
  Download,
  FileText,
  Handshake,
  MapPin,
  Receipt,
  Wallet,
} from "lucide-react";

const withLazyBoundary = (LazyComponent) => {
  function LazyFeature(props) {
    return (
      <Suspense fallback={<div style={{ padding: 24, textAlign: "center", color: "#6B7280", fontSize: 13 }}>Loading…</div>}>
        <LazyComponent {...props} />
      </Suspense>
    );
  }
  return LazyFeature;
};

const lazyDefault = (loader) => withLazyBoundary(lazy(loader));
const lazyNamed = (loader, exportName) => withLazyBoundary(lazy(() => loader().then((mod) => ({ default: mod[exportName] }))));

const CollectionsPanel = lazyDefault(() => import("../Collections.jsx"));
const DealValueReport = lazyDefault(() => import("../DealValueReport.jsx"));
const AttendanceReport = lazyDefault(() => import("../AttendanceReportV2.jsx"));
const EnhancedDailyActivityReport = lazyDefault(() => import("../EnhancedDailyActivityReport.jsx"));
const DayClosingReports = lazyNamed(() => import("../DayClosingReportOptimized.jsx"), "DayClosingReports");

const REPORT_CARDS = [
  { key: "deal-values", title: "Deal Value", desc: "Total deal value for Cold, Hot, Negotiation and every stage.", icon: Wallet, color: "#145C5D" },
  { key: "performance", title: "Employee performance", desc: "Weekly/monthly leads, follow-ups, quotations, wins, sales and collections.", icon: Contact2, color: "#145C5D" },
  { key: "funnel", title: "Funnel and conversion", desc: "Lead count and drop-off at each pipeline stage.", icon: Handshake, color: "#7B4FC9" },
  { key: "renewals", title: "Renewals due", desc: "Everything renewing in the next 30, 60 or 90 days.", icon: CalendarClock, color: "#B8791F" },
  { key: "payments", title: "Payments", desc: "Collections, pending balances, overdue payments and receipts in one place.", icon: Wallet, color: "#C0392B" },
  { key: "expenses", title: "Expenses", desc: "Salary and other spending, broken down by category.", icon: Receipt, color: "#993C1D", sidebarOnly: true },
  { key: "attendance", title: "Attendance Report", desc: "Start day, end day, working duration and day closing status.", icon: Clock, color: "#145C5D" },
  { key: "day-closing", title: "Day Closing Report", desc: "Submitted, pending, skipped and not-required day closing reports with employee detail.", icon: FileText, color: "#145C5D" },
  { key: "daily", title: "Daily activity", desc: "Visits, leads touched and distance travelled per day.", icon: MapPin, color: "#12805C" },
  { key: "stage", title: "Time in stage", desc: "Average days a lead spends at each status.", icon: Clock, color: "#8B5E00" },
  { key: "quality", title: "Data quality", desc: "Find leads missing important sales information and fix them.", icon: AlertTriangle, color: "#B8791F" },
  { key: "export", title: "Lead export", desc: "Download leads as CSV, Excel, or push to Google Sheets.", icon: Download, color: "#1D7A8C" },
];

export default function AdminReportsPage({ salesmen, leads, shared }) {
  const {
    T,
    SalesmanPerformanceReport,
    FunnelReport,
    RenewalsReport,
    TimeInStageReport,
    DataQualityReport,
    LeadExportReport,
  } = shared;
  const [active, setActive] = useState(() => {
    const requested = sessionStorage.getItem("engage:open-report");
    if (requested && REPORT_CARDS.some((card) => card.key === requested)) {
      sessionStorage.removeItem("engage:open-report");
      return requested;
    }
    return null;
  });
  useEffect(() => {
    const openExpenses = () => {
      sessionStorage.removeItem("engage:open-report");
      setActive("expenses");
    };
    window.addEventListener("engage:open-expenses", openExpenses);
    return () => window.removeEventListener("engage:open-expenses", openExpenses);
  }, []);
  const activeCard = REPORT_CARDS.find((card) => card.key === active);

  if (active === "expenses") {
    return <div className="engage-reports-page"><ExpensesWorkspace salesmen={salesmen} /></div>;
  }

  if (!active) {
    return (
      <div className="engage-reports-page">
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Reports</div>
        <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 16 }}>Choose a report to view</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          {REPORT_CARDS.filter((card) => !card.sidebarOnly).map((card) => (
            <div
              key={card.key}
              onClick={() => setActive(card.key)}
              className="ft-card"
              style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 16, cursor: "pointer", boxShadow: "0 1px 2px rgba(20,20,30,0.04)" }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 9, background: `${card.color}1A`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                <card.icon size={17} color={card.color} />
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4 }}>{card.title}</div>
              <div style={{ fontSize: 12, color: T.inkSoft, lineHeight: 1.5 }}>{card.desc}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="engage-reports-page">
      <button
        onClick={() => setActive(null)}
        style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: T.inkSoft, background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 16 }}
      >
        ← Back to reports
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
        {activeCard && <activeCard.icon size={18} color={activeCard.color} />}
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17 }}>{activeCard?.title}</div>
      </div>
      {active === "deal-values" && <DealValueReport />}
      {active === "performance" && <SalesmanPerformanceReport salesmen={salesmen} leads={leads} />}
      {active === "funnel" && <FunnelReport leads={leads} />}
      {active === "renewals" && <RenewalsReport leads={leads} />}
      {active === "payments" && <CollectionsPanel embedded />}
      {active === "attendance" && <AttendanceReport salesmen={salesmen} />}
      {active === "day-closing" && <DayClosingReports embedded />}
      {active === "daily" && <EnhancedDailyActivityReport salesmen={salesmen} />}
      {active === "stage" && <TimeInStageReport />}
      {active === "quality" && <DataQualityReport salesmen={salesmen} />}
      {active === "export" && <LeadExportReport salesmen={salesmen} />}
    </div>
  );
}
