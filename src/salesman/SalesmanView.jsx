import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { AlertTriangle, Play, Square, CheckCircle2, Loader2, WifiOff, Target as TargetIcon, Flame, MessageSquare, Handshake, CalendarClock, Plus, List, Search } from "lucide-react";
import AdminMobileNav, { useAdminPhone, salesmanTabs } from "../AdminMobileNav.jsx";
import { api, mapLeadRow } from "../api.js";
import useSalesmanTasks from "../useSalesmanTasks.js";
import { showSaveFeedback } from "../saveFeedback.js";
import MobileContacts from "../MobileContacts.jsx";
import SalesmanTargetCard from "./SalesmanTargetCard.jsx";

const lazyNamed = (loader, exportName) => {
  const LazyComponent = lazy(() => loader().then((mod) => ({ default: mod[exportName] })));
  return function LazyFeature(props) {
    return <Suspense fallback={<div style={{ padding: 12, textAlign: "center", color: "#6B7280", fontSize: 12 }}>Loading…</div>}><LazyComponent {...props} /></Suspense>;
  };
};
const TasksEntry = lazyNamed(() => import("../Tasks.jsx"), "TasksEntry");
const TasksModal = lazyNamed(() => import("../Tasks.jsx"), "TasksModal");

export default function SalesmanView({ notificationLead, session, leads, leadSummary, hasMoreLeads, loadMoreLeads, loadingMoreLeads, totalLeadCount, dayStarted, allowLeadWithoutStartDay, onToggleDay, togglingDay, justToggledDay, onAddLead, onUpdateLeadStatus, onUpdateLeadDetails, online, gpsStatus, queuedCount, loadError, messages, onMarkMessageRead, onDeleteMessage, onReplyMessage, employeeRepliesEnabled = true, dailyTarget, monthlyTarget, page, shared }) {
  const { T, fmtMoney, isToday, isThisMonth, isWithinDays, isUpcomingRenewalMonth, SalesmanReportsPage, StatCard, MessagesSection, MyLeadsModal, AddLeadModal, LeadDetailDrawer, VerificationStamp, NoLocationBadge } = shared;
  const { pendingTasks, handlePendingTasksChange } = useSalesmanTasks();
  const phone = useAdminPhone();
  const [mobileTab, setMobileTab] = useState("dashboard");
  const [visited, setVisited] = useState({});
  const positions = useRef({});
  const switchTab = tab => {
    positions.current[mobileTab] = window.scrollY;
    setVisited(current => ({ ...current, [tab]: true }));
    setMobileTab(tab);
  };
  useEffect(() => {
    if (!phone) return;
    const frame = requestAnimationFrame(() => window.scrollTo({ top: positions.current[mobileTab] || 0, behavior: "instant" }));
    return () => cancelAnimationFrame(frame);
  }, [phone, mobileTab]);
  const dashboard = !phone || mobileTab === "dashboard";
  const [showAddLead, setShowAddLead] = useState(false);
  const [showMyLeads, setShowMyLeads] = useState(false);
  const [viewingLead, setViewingLead] = useState(null);
  const [showTodayLeads, setShowTodayLeads] = useState(false);
  const [showHotLeads, setShowHotLeads] = useState(false);
  const [showConverted, setShowConverted] = useState(false);
  const [showNegotiation, setShowNegotiation] = useState(false);
  const [showConversation, setShowConversation] = useState(false);
  const [showRenewals, setShowRenewals] = useState(false);
  const [contactSearch, setContactSearch] = useState("");

  const [notificationLeadError, setNotificationLeadError] = useState("");
  useEffect(() => {
    if (!notificationLead) return;
    let cancelled = false;
    setNotificationLeadError("");
    setShowAddLead(false); setShowMyLeads(false); setShowTodayLeads(false); setShowHotLeads(false);
    setShowConverted(false); setShowNegotiation(false); setShowConversation(false); setShowRenewals(false);
    setViewingLead(null);
    api.salesmanLead(notificationLead.id).then(res => {
      if (!cancelled) setViewingLead(mapLeadRow(res.lead));
    }).catch(err => { if (!cancelled) setNotificationLeadError(err.message || "Couldn't open this lead. Please refresh your briefing."); });
    return () => { cancelled = true; };
  }, [notificationLead]);

  const todayLeads = leads.filter((l) => isToday(l.createdAt));
  const monthLeads = leads.filter((l) => isThisMonth(l.createdAt));
  const allHotLeads = leads.filter((l) => l.status === "hot");
  const converted = leads.filter((l) => l.status === "won").length;
  const convertedValue = leads.filter((l) => l.status === "won" && l.dealValue != null).reduce((sum, l) => sum + l.dealValue, 0);
  const pending = leads.filter((l) => !["won", "lost"].includes(l.status)).length;
  const inConversation = leads.filter((l) => l.status === "conversation");
  const inNegotiation = leads.filter((l) => l.status === "negotiation");
  const upcomingRenewals = leads.filter((l) =>
    (l.renewalDate && isWithinDays(new Date(l.renewalDate), 30)) ||
    (!l.renewalDate && isUpcomingRenewalMonth(l.renewalMonth))
  );
  const target = Number(dailyTarget) > 0 ? Number(dailyTarget) : 0;
  const monthTarget = Number(monthlyTarget) > 0 ? Number(monthlyTarget) : 0;
  const todayCount = leadSummary?.today ?? todayLeads.length;
  const monthCount = leadSummary?.month ?? monthLeads.length;
  const hotCount = leadSummary?.hot ?? allHotLeads.length;
  const conversationCount = leadSummary?.conversation ?? inConversation.length;
  const negotiationCount = leadSummary?.negotiation ?? inNegotiation.length;
  const wonCount = leadSummary?.won ?? converted;
  const wonValue = leadSummary?.wonValue ?? convertedValue;
  const renewalCount = leadSummary?.renewalsDue ?? upcomingRenewals.length;
  const leadPagingProps = { hasMore: hasMoreLeads, onLoadMore: loadMoreLeads, loadingMore: loadingMoreLeads, totalCount: totalLeadCount };
  const contactNeedle = contactSearch.trim().toLowerCase();
  const contactRows = leads.filter((lead) => !contactNeedle || [lead.owner, lead.business, lead.phone, lead.subLocation].some((value) => String(value || "").toLowerCase().includes(contactNeedle)));

  useEffect(() => {
    if (page === "reports" && hasMoreLeads && !loadingMoreLeads) loadMoreLeads?.();
  }, [page, hasMoreLeads, loadingMoreLeads, loadMoreLeads, leads.length]);

  return (
    <div className={phone && page !== "reports" ? "engage-admin-mobile-content" : undefined} style={{ maxWidth: 480, margin: "0 auto", padding: "18px 16px 40px" }}>
      {page === "reports" ? (
        <SalesmanReportsPage leads={leads} dailyTarget={target} monthlyTarget={monthTarget} />
      ) : (
        <>
      <div hidden={!dashboard}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18 }}>{session.fullName}</div>
          <div style={{ fontSize: 12, color: T.inkSoft }}>{session.phone}</div>
        </div>
        <button
          onClick={onToggleDay}
          disabled={togglingDay}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 11, border: "none",
            cursor: togglingDay ? "default" : "pointer", opacity: togglingDay ? 0.75 : 1,
            background: justToggledDay ? T.verifiedSoft : dayStarted ? T.dangerSoft : T.verifiedSoft,
            color: justToggledDay ? T.verified : dayStarted ? T.danger : T.verified, fontWeight: 700, fontSize: 13,
          }}
        >
          {togglingDay ? <Loader2 size={14} className="spin" /> : justToggledDay ? <CheckCircle2 size={14} /> : dayStarted ? <Square size={14} /> : <Play size={14} />}
          {togglingDay ? (dayStarted ? "Ending…" : "Starting…") : justToggledDay ? (dayStarted ? "Started" : "Ended") : dayStarted ? "End Day" : "Start Day"}
        </button>
      </div>

      {notificationLeadError && <div role="alert" style={{ padding: 12, color: T.danger, background: T.dangerSoft, marginBottom: 14 }}>{notificationLeadError}</div>}
      {loadError && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.danger, background: T.dangerSoft, borderRadius: 11, padding: "9px 12px", marginBottom: 14 }}>
          <AlertTriangle size={14} /> {loadError}
        </div>
      )}

      {(!online || queuedCount > 0) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.warn, background: T.warnSoft, padding: "9px 12px", borderRadius: 11, marginBottom: 14 }}>
          <WifiOff size={14} />
          {!online
            ? "No connection — leads you capture now are saved on this device and will sync automatically once you're back online."
            : `Syncing ${queuedCount} queued lead${queuedCount === 1 ? "" : "s"}…`}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 16 }}>
        <StatCard label="Today" value={todayCount} icon={TargetIcon} color={T.route} onClick={() => setShowTodayLeads(true)} />
        <StatCard label="Hot" value={hotCount} icon={Flame} color={T.danger} onClick={() => setShowHotLeads(true)} />
        <StatCard label="Conversation" value={conversationCount} icon={MessageSquare} color={T.accent} onClick={() => setShowConversation(true)} />
        <StatCard label="Negotiation" value={negotiationCount} icon={Handshake} color={T.warn} onClick={() => setShowNegotiation(true)} />
        <StatCard label="Won" value={wonCount} sub={wonValue > 0 ? fmtMoney(wonValue) : undefined} icon={CheckCircle2} color={T.verified} onClick={() => setShowConverted(true)} />
        <StatCard label="Renewals" value={renewalCount} sub="next 30 days" icon={CalendarClock} color={T.accent} onClick={() => setShowRenewals(true)} />
      </div>

      <SalesmanTargetCard
        T={T}
        monthCount={monthCount}
        monthTarget={monthTarget}
        todayCount={todayCount}
        dailyTarget={target}
        wonValue={wonValue}
        fmtMoney={fmtMoney}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <BigButton T={T} icon={Plus} label="Add Deal" onClick={() => setShowAddLead(true)} primary disabled={!dayStarted && !allowLeadWithoutStartDay} />
        <BigButton T={T} icon={List} label="My Deal" onClick={() => phone ? switchTab("leads") : setShowMyLeads(true)} />
      </div>

      {!dayStarted && !allowLeadWithoutStartDay && <div style={{ marginTop: 12, fontSize: 12, color: T.warn, background: T.warnSoft, padding: "8px 10px", borderRadius: 11 }}>Start your day to enable lead capture.</div>}

      </div>
      <div hidden={!dashboard && mobileTab !== "messages"}>
      <MessagesSection messages={messages} onMarkRead={onMarkMessageRead} onDelete={onDeleteMessage} onReply={onReplyMessage} employeeRepliesEnabled={employeeRepliesEnabled} onOpenLead={(id) => { const found = leads.find(l => l.id === id); if (found) setViewingLead(found); else api.salesmanLead(id).then(r => setViewingLead(mapLeadRow(r.lead))).catch(() => setNotificationLeadError("Couldn't open this lead.")); }} />
      </div>
      <div hidden={!dashboard}><TasksEntry onPendingChange={handlePendingTasksChange} /></div>
      {visited.leads && <div hidden={!phone || mobileTab !== "leads"}>
        <MyLeadsModal {...leadPagingProps} embedded leads={leads} onSelectLead={setViewingLead} allowDateFilter employeeMobile />
      </div>}
      {visited.contacts && <section hidden={!phone || mobileTab !== "contacts"} className="engage-salesman-contacts">
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: 18, margin: "0 0 4px" }}>Contacts</h2>
          <div style={{ fontSize: 12, color: T.inkSoft }}>{totalLeadCount ?? leads.length} contact records · Your contacts</div>
        </div>
        <div style={{ position: "relative", marginBottom: 12 }}>
          <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: T.inkSoft }} />
          <input aria-label="Search contacts" value={contactSearch} onChange={(event) => setContactSearch(event.target.value)} placeholder="Search by contact, company, phone, or area…" style={{ width: "100%", padding: "9px 12px 9px 32px", borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 13.5, boxSizing: "border-box" }} />
        </div>
        <MobileContacts leads={contactRows} onSelectLead={setViewingLead} enableCall showVerification={false} />
        {hasMoreLeads && <button type="button" disabled={loadingMoreLeads} onClick={loadMoreLeads} style={{ width: "100%", marginTop: 12, padding: "10px 12px", borderRadius: 9, border: `1px solid ${T.line}`, background: "#fff", color: T.route, fontWeight: 800, cursor: loadingMoreLeads ? "default" : "pointer", opacity: loadingMoreLeads ? .65 : 1 }}>{loadingMoreLeads ? "Loading more…" : `Load more contacts · ${Math.max(0, (totalLeadCount ?? leads.length) - leads.length)} remaining`}</button>}
      </section>}
      {visited.tasks && <div hidden={!phone || mobileTab !== "tasks"}><TasksModal embedded active={phone && mobileTab === "tasks"} /></div>}
      {phone && mobileTab === "more" && <section className="engage-salesman-more"><h2>More</h2>
        {[["quotations", "Quotations"], ["onboarding", "Onboarding checklist"], ["payments", "Payment due"], ["daily", "My Daily Reports"], ["settings", "Settings"]].map(([key, label]) => <button type="button" key={key} onClick={() => window.dispatchEvent(new CustomEvent("engage:salesman-more", { detail: key }))}>{label}<span aria-hidden="true">›</span></button>)}
      </section>}
      <AdminMobileNav active={mobileTab} onChange={switchTab} items={salesmanTabs} counts={{ tasks: pendingTasks, messages: messages.filter(message => !message.read_at).length }} label="Salesman navigation" />

      {showAddLead && (
        <AddLeadModal
          session={session}
          online={online}
          onClose={() => setShowAddLead(false)}
          onSubmit={onAddLead}
          onSaved={(lead) => { showSaveFeedback(lead.syncStatus === "queued" ? "Lead saved on device · Sync pending" : "Lead saved"); setShowAddLead(false); setViewingLead(lead); }}
        />
      )}
      {showMyLeads && <MyLeadsModal {...leadPagingProps} leads={leads} onClose={() => setShowMyLeads(false)} onSelectLead={setViewingLead} allowDateFilter />}
      {showTodayLeads && (
        <MyLeadsModal {...leadPagingProps}
          leads={todayLeads}
          title="Today's Leads"
          onClose={() => setShowTodayLeads(false)}
          onSelectLead={(l) => { setShowTodayLeads(false); setViewingLead(l); }}
        />
      )}
      {showHotLeads && (
        <MyLeadsModal {...leadPagingProps}
          leads={allHotLeads}
          title="🔥 Hot Leads"
          onClose={() => setShowHotLeads(false)}
          onSelectLead={(l) => { setShowHotLeads(false); setViewingLead(l); }}
        />
      )}
      {showConverted && (
        <MyLeadsModal {...leadPagingProps}
          leads={leads.filter((l) => l.status === "won")}
          title="Won Leads"
          onClose={() => setShowConverted(false)}
          onSelectLead={(l) => { setShowConverted(false); setViewingLead(l); }}
        />
      )}
      {showNegotiation && (
        <MyLeadsModal {...leadPagingProps}
          leads={inNegotiation}
          title="In Negotiation"
          onClose={() => setShowNegotiation(false)}
          onSelectLead={(l) => { setShowNegotiation(false); setViewingLead(l); }}
        />
      )}
      {showConversation && (
        <MyLeadsModal {...leadPagingProps}
          leads={inConversation}
          title="In Conversation"
          onClose={() => setShowConversation(false)}
          onSelectLead={(l) => { setShowConversation(false); setViewingLead(l); }}
        />
      )}
      {showRenewals && (
        <MyLeadsModal {...leadPagingProps}
          leads={upcomingRenewals}
          title="Renewals Due (Next 30 Days)"
          onClose={() => setShowRenewals(false)}
          onSelectLead={(l) => { setShowRenewals(false); setViewingLead(l); }}
        />
      )}
      {viewingLead && <LeadDetailDrawer lead={leads.find((l) => l.id === viewingLead.id) || viewingLead} onClose={() => setViewingLead(null)} onStatusChange={onUpdateLeadStatus} onUpdate={onUpdateLeadDetails} fetchHistory={api.salesmanLeadHistory} employeeRepliesEnabled={employeeRepliesEnabled} />}
      </>
      )}
    </div>
  );
}

function BigButton({ T, icon: IconC, label, onClick, primary, disabled }) {
  return (
    <button onClick={disabled ? undefined : onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "20px 10px", borderRadius: 12, border: `1px solid ${T.line}`, cursor: disabled ? "not-allowed" : "pointer", background: primary ? T.route : "#fff", color: primary ? "#fff" : T.ink, fontWeight: 700, fontSize: 14, opacity: disabled ? 0.5 : 1 }}>
      <IconC size={22} />{label}
    </button>
  );
}
