import React from "react";

// Admin map and orchestration extracted from App.jsx without changing behavior.
export function createAdminAppView(deps) {
  const { useState, useEffect, useRef, L, api, ApiError, T, fmtMoney, fmtTime, isToday, isWithinDays, isUpcomingRenewalMonth, comparisonFor, dailyComparisonFor, getDashboardDisplaySettings, STATUS_LABEL, STATUSES, useAdminPhone, AdminMobileNav, AdminAddLeadModalV2, AdminEmployeesPanel, AdminDashboardPanel, AdminLeadsPanel, AdminReportsPage, useAdminData, TasksModal, DataQualityReport, SalesmanPerformanceReport, FunnelReport, RenewalsReport, ExpensesReport, TimeInStageReport, LeadExportReport, LeadsBoardView, MessageComposeModal, LeadDetailDrawer, SalesmanFormModal, MyLeadsModal, SalesmanRouteModal, VerificationStamp, NoLocationBadge, leadAvatarStyle, leadInitials, Overlay, Select, Tab, LegendDot, DownloadMenu, inputStyle, Loader2, Radio, Lock, LockOpen, AlertTriangle, RefreshCw, AdminTeamActivitySheet, SalesmanBriefPopup, EmployeeSettings, showSaveFeedback } = deps;

function LiveMap({ salesmen, leads, onSelectLead, title = "Live Employees & Lead Map", subtitle, headerControls }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const salesmanMarkersRef = useRef({});
  const leadMarkersRef = useRef({});
  const onSelectLeadRef = useRef(onSelectLead);
  const flownOnceRef = useRef(false);
  const [locked, setLocked] = useState(true); // frozen by default so an accidental touch/scroll doesn't drag the map
  onSelectLeadRef.current = onSelectLead;

  const salesmanIcon = (s) =>
    L.divIcon({
      className: "",
      html: `
        <div style="position:relative;display:flex;align-items:center;">
          <div style="position:absolute;width:16px;height:16px;border-radius:50%;background:${T.route};opacity:${s.status === "online" ? 0.35 : 0};animation:pulseMarker 1.6s ease-out infinite;"></div>
          <div style="position:relative;width:16px;height:16px;border-radius:50%;background:${s.status === "online" ? T.route : "#9AA5B1"};border:2px solid ${s.status === "online" ? T.verified : "#fff"};box-shadow:0 1px 4px rgba(0,0,0,0.35);"></div>
          <div style="margin-left:6px;padding:1px 6px;background:${T.ink};color:${T.paper};font:600 10.5px Inter,sans-serif;border-radius:4px;white-space:nowrap;">${s.name.split(" ")[0]}${s.status === "online" ? " · LIVE" : ""}</div>
        </div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

  const leadColor = (l) => (l.verification === "verified" ? T.verified : l.verification === "poor_accuracy" ? T.warn : T.danger);
  const leadIcon = (l) =>
    L.divIcon({
      className: "",
      html: `<div style="width:12px;height:12px;border-radius:50%;background:${leadColor(l)};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35);cursor:pointer;"></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: [26.847, 80.975], zoom: 12, scrollWheelZoom: false, dragging: false, touchZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const toggle = (name) => (locked ? map[name].disable() : map[name].enable());
    toggle("dragging");
    toggle("scrollWheelZoom");
    toggle("touchZoom");
    toggle("doubleClickZoom");
    toggle("boxZoom");
    if (map.keyboard) toggle("keyboard");
  }, [locked]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set();
    const positioned = salesmen.filter((s) => s.lat != null && s.lng != null);
    positioned.forEach((s) => {
      seen.add(s.id);
      const existing = salesmanMarkersRef.current[s.id];
      if (existing) {
        existing.setLatLng([s.lat, s.lng]);
        existing.setIcon(salesmanIcon(s));
      } else {
        const marker = L.marker([s.lat, s.lng], { icon: salesmanIcon(s), zIndexOffset: 500 }).addTo(map);
        marker.bindTooltip(`${s.name} · ${s.area}`, { direction: "top", offset: [0, -8] });
        salesmanMarkersRef.current[s.id] = marker;
      }
    });
    Object.keys(salesmanMarkersRef.current).forEach((id) => {
      if (!seen.has(id)) { salesmanMarkersRef.current[id].remove(); delete salesmanMarkersRef.current[id]; }
    });
    if (!flownOnceRef.current && positioned.length > 0) {
      flownOnceRef.current = true;
      const group = L.featureGroup(Object.values(salesmanMarkersRef.current));
      map.fitBounds(group.getBounds().pad(0.4), { maxZoom: 14 });
    }
  }, [salesmen]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set();
    const positionedLeads = leads.filter((l) => l.lat != null && l.lng != null);
    positionedLeads.forEach((l) => {
      seen.add(l.id);
      const existing = leadMarkersRef.current[l.id];
      if (existing) {
        existing.setLatLng([l.lat, l.lng]);
        existing.setIcon(leadIcon(l));
      } else {
        const marker = L.marker([l.lat, l.lng], { icon: leadIcon(l) }).addTo(map);
        marker.on("click", () => onSelectLeadRef.current(l));
        marker.bindTooltip(l.business, { direction: "top", offset: [0, -6] });
        leadMarkersRef.current[l.id] = marker;
      }
    });
    Object.keys(leadMarkersRef.current).forEach((id) => {
      if (!seen.has(id)) { leadMarkersRef.current[id].remove(); delete leadMarkersRef.current[id]; }
    });
  }, [leads]);

  return (
    <div className="ft-card" style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18, display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: subtitle ? 2 : 8, flexWrap: "wrap" }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}>{title}</div>
        {headerControls || (!subtitle && <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: T.verified, fontFamily: "'IBM Plex Mono', monospace" }}><Radio size={12} /> LIVE</div>)}
      </div>
      {subtitle && <div style={{ fontSize: 11.5, color: T.inkSoft, marginBottom: 8 }}>{subtitle}</div>}
      <div style={{ position: "relative", flex: 1, minHeight: subtitle ? 460 : 360 }}>
        <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: subtitle ? 460 : 360, borderRadius: 11, overflow: "hidden" }} />
        <button
          onClick={() => setLocked((v) => !v)}
          title={locked ? "Map is locked — tap to unlock and move it" : "Map is unlocked — tap to lock it in place"}
          style={{
            position: "absolute", top: 10, right: 10, zIndex: 1000, display: "flex", alignItems: "center", gap: 6,
            padding: "7px 11px", borderRadius: 999, border: "none", cursor: "pointer",
            background: locked ? "rgba(26,29,35,0.85)" : T.route, color: "#fff", fontSize: 11.5, fontWeight: 700,
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          }}
        >
          {locked ? <Lock size={13} /> : <LockOpen size={13} />} {locked ? "Locked" : "Movable"}
        </button>
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap", fontSize: 11, color: T.inkSoft }}>
        {salesmen.length > 0 && <LegendDot color={T.route} label="Employee (online)" />}
        <LegendDot color={T.verified} label="Verified lead" />
        <LegendDot color={T.warn} label="Poor accuracy" />
        <LegendDot color={T.danger} label="Unverified" />
      </div>
      <div style={{ fontSize: 10.5, color: "#9AA5B1", marginTop: 6 }}>Live map data © OpenStreetMap contributors — free, no API key.</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ADMIN — real data: fetches roster/leads/summary, keeps a WebSocket open
// for instant pushes (new leads, live location, status changes), and falls
// back to a periodic refetch as a safety net if the socket drops.
// ---------------------------------------------------------------------------
function AdminApp({ desktopSection, session, online, page, notificationLead }) {
  const {
    conversationCount,
    salesmen,
    leads,
    loading,
    loadError,
    wsConnected,
    onStatusChange,
    onUpdateLead,
    onDeleteLead,
    onAddLead,
    onAddSalesman,
    onEditSalesman,
    onDeleteSalesman,
    onToggleSalesmanActive,
  } = useAdminData({ online, session });

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 60, color: T.inkSoft, fontSize: 13 }}>
        <Loader2 size={16} className="spin" /> Loading dashboard…
      </div>
    );
  }

  return (
    <AdminView
      desktopSection={desktopSection}
      conversationCount={conversationCount}
      salesmen={salesmen}
      leads={leads}
      onStatusChange={onStatusChange}
      onUpdateLead={onUpdateLead}
      onDeleteLead={onDeleteLead}
      onAddLead={onAddLead}
      onAddSalesman={onAddSalesman}
      onEditSalesman={onEditSalesman}
      onDeleteSalesman={onDeleteSalesman}
      onToggleSalesmanActive={onToggleSalesmanActive}
      loadError={loadError}
      wsConnected={wsConnected}
      online={online}
      page={page}
      notificationLead={notificationLead}
    />
  );
}

function AdminView({ desktopSection, conversationCount, salesmen, leads, onStatusChange, onUpdateLead, onDeleteLead, onAddLead, onAddSalesman, onEditSalesman, onDeleteSalesman, onToggleSalesmanActive, loadError, wsConnected, online, page, notificationLead }) {
  const phone = useAdminPhone();
  const [mobileTab, setMobileTab] = useState("dashboard");
  const [showTeamActivity, setShowTeamActivity] = useState(false);
  const [tasksVisited, setTasksVisited] = useState(false);
  const desktopPositions = useRef({});
  const previousDesktopSection = useRef(null);
  useEffect(() => {
    if (!desktopSection) return;
    if (desktopSection === "tasks") setTasksVisited(true);
    const previous = previousDesktopSection.current;
    if (previous) desktopPositions.current[previous] = window.scrollY;
    previousDesktopSection.current = desktopSection;
    const frame = requestAnimationFrame(() => window.scrollTo({ top: desktopPositions.current[desktopSection] || 0, behavior: "instant" }));
    return () => cancelAnimationFrame(frame);
  }, [desktopSection]);
  const section = desktopSection || mobileTab;
  const sectionNavigation = phone || Boolean(desktopSection);
  const [expensesVisited, setExpensesVisited] = useState(false);
  const scrollPositions = useRef({});
  const switchMobileTab = (tab) => {
    scrollPositions.current[mobileTab] = window.scrollY;
    if (tab === "expenses") setExpensesVisited(true);
    setMobileTab(tab);
  };
  useEffect(() => {
    if (!phone) return;
    const frame = requestAnimationFrame(() => window.scrollTo({ top: scrollPositions.current[mobileTab] || 0, behavior: "instant" }));
    return () => cancelAnimationFrame(frame);
  }, [mobileTab, phone]);
  const desktopDeals = desktopSection === "deals";
  const desktopContacts = desktopSection === "leads";
  const showDashboard = !sectionNavigation || section === "dashboard";
  const showLeads = showDashboard || section === "leads" || section === "deals";
  const [filterSalesman, setFilterSalesman] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [leadsViewMode, setLeadsViewMode] = useState("board"); // "list" | "board"
  const [showAdminAddLead, setShowAdminAddLead] = useState(false);
  const [leadsPage, setLeadsPage] = useState(1);
  const LEADS_PER_PAGE = 50;
  const [selectedLead, setSelectedLead] = useState(null);
  useEffect(() => {
    if (!notificationLead?.id) return;
    const lead = leads.find((item) => item.id === notificationLead.id);
    if (lead) setSelectedLead(lead);
  }, [notificationLead, leads]);
  const [showAddSalesman, setShowAddSalesman] = useState(false);
  const [editSalesman, setEditSalesman] = useState(null);
  const [employeeSettings,setEmployeeSettings]=useState(null);
  const [briefSalesman,setBriefSalesman]=useState(null);
  const [deleteSalesmanConfirm, setDeleteSalesmanConfirm] = useState(null);
  const [deleteSalesmanError, setDeleteSalesmanError] = useState("");
  const [messageTarget, setMessageTarget] = useState(null); // salesman object | "all" | null
  const [routeSalesman, setRouteSalesman] = useState(null);
  const [viewingSalesmanLeads, setViewingSalesmanLeads] = useState(null);
  const [mapView, setMapView] = useState("live"); // "live" | "leads"
  const [statLeadsModal, setStatLeadsModal] = useState(null); // { title, leads } | null

  const filteredLeads = leads.filter(
    (l) =>
      (filterSalesman === "all" || l.salesmanId === filterSalesman) &&
      (filterStatus === "all" || l.status === filterStatus) &&
      (!filterDate || l.createdAt.toISOString().slice(0, 10) === filterDate) &&
      (!searchQuery.trim() || [l.business, l.owner, l.phone, l.subLocation].some((f) => f && f.toLowerCase().includes(searchQuery.trim().toLowerCase())))
  );

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / LEADS_PER_PAGE));
  const currentPage = Math.min(leadsPage, totalPages);
  const pagedLeads = filteredLeads.slice((currentPage - 1) * LEADS_PER_PAGE, currentPage * LEADS_PER_PAGE);

  useEffect(() => { setLeadsPage(1); }, [filterSalesman, filterStatus, filterDate, searchQuery]);

  return (
    <div className={phone && page !== "reports" ? "engage-admin-mobile-content" : undefined} style={{ padding: desktopDeals || desktopContacts ? "20px 28px" : "20px 24px", maxWidth: desktopDeals || desktopContacts ? 1500 : 1180, margin: "0 auto" }}>
      {page === "reports" ? (
        <AdminReportsPage
          salesmen={salesmen}
          leads={leads}
          shared={{
            T, SalesmanPerformanceReport, FunnelReport, RenewalsReport, ExpensesReport,
            TimeInStageReport, DataQualityReport, LeadExportReport,
          }}
        />
      ) : (
        <>
      {loadError && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.danger, background: T.dangerSoft, borderRadius: 11, padding: "9px 12px", marginBottom: 14 }}>
          <AlertTriangle size={14} /> {loadError}
        </div>
      )}
      {online && !wsConnected && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: T.warn, background: T.warnSoft, borderRadius: 11, padding: "8px 12px", marginBottom: 14 }}>
          <RefreshCw size={12} className="spin" /> Reconnecting live updates… data still refreshes every 15s in the meantime.
        </div>
      )}

      <AdminDashboardPanel
        phone={phone}
        showDashboard={showDashboard}
        salesmen={salesmen}
        leads={leads}
        conversationCount={conversationCount}
        onShowTeamActivity={() => setShowTeamActivity(true)}
        onOpenStatLeads={setStatLeadsModal}
        shared={{
          T, fmtMoney, isToday, isWithinDays, isUpcomingRenewalMonth,
          comparisonFor, dailyComparisonFor, getDashboardDisplaySettings,
        }}
      />
      <div hidden={!showDashboard && section !== "employees"}>
            {mapView === "live" || (sectionNavigation && section === "employees") ? (
        <div className={sectionNavigation && section === "employees" ? undefined : "ft-dashboard-grid"}>
          {showDashboard && <LiveMap
            salesmen={salesmen}
            leads={leads}
            onSelectLead={setSelectedLead}
            headerControls={<div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Tab active={mapView === "live"} onClick={() => setMapView("live")} label="Live Map" />
              <Tab active={mapView === "leads"} onClick={() => setMapView("leads")} label="Lead Locations" />
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 9px", borderRadius: 999, background: T.verifiedSoft, color: T.verified, fontSize: 10.5, fontWeight: 800, letterSpacing: ".04em" }}><Radio size={12} /> LIVE</span>
            </div>}
          />}
          <AdminEmployeesPanel
            salesmen={salesmen}
            leads={leads}
            shared={{ T, inputStyle }}
            onAddClick={() => setShowAddSalesman(true)}
            onSettingsClick={setEmployeeSettings}
            onBriefClick={setBriefSalesman}
            onDeleteClick={setDeleteSalesmanConfirm}
            onViewRoute={setRouteSalesman}
            onMessageClick={setMessageTarget}
            onOpenSalesmanLeads={setViewingSalesmanLeads}
          />
        </div>
      ) : (
        showDashboard && <LiveMap
          salesmen={[]}
          leads={filteredLeads}
          onSelectLead={setSelectedLead}
          title="Live Employees & Lead Map"
          subtitle="Respects the employee/status/date filters below"
          headerControls={<div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Tab active={mapView === "live"} onClick={() => setMapView("live")} label="Live Map" />
            <Tab active={mapView === "leads"} onClick={() => setMapView("leads")} label="Lead Locations" />
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 9px", borderRadius: 999, background: T.verifiedSoft, color: T.verified, fontSize: 10.5, fontWeight: 800, letterSpacing: ".04em" }}><Radio size={12} /> LIVE</span>
          </div>}
        />
      )}

      </div>
      <AdminLeadsPanel
        showLeads={showLeads}
        desktopDeals={desktopDeals}
        desktopContacts={desktopContacts}
        sectionNavigation={sectionNavigation}
        section={section}
        desktopSection={desktopSection}
        phone={phone}
        salesmen={salesmen}
        filteredLeads={filteredLeads}
        pagedLeads={pagedLeads}
        leadsViewMode={leadsViewMode}
        setLeadsViewMode={setLeadsViewMode}
        filterSalesman={filterSalesman}
        setFilterSalesman={setFilterSalesman}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        filterDate={filterDate}
        setFilterDate={setFilterDate}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        LEADS_PER_PAGE={LEADS_PER_PAGE}
        currentPage={currentPage}
        setLeadsPage={setLeadsPage}
        totalPages={totalPages}
        onStatusChange={onStatusChange}
        onSelectLead={setSelectedLead}
        onAddClick={onAddLead ? () => setShowAdminAddLead(true) : null}
        shared={{
          T, fmtMoney, Select, STATUSES, STATUS_LABEL, DownloadMenu, VerificationStamp,
          NoLocationBadge, LeadsBoardView, leadAvatarStyle, leadInitials, fmtTime,
        }}
      />
      {expensesVisited && <div hidden={!phone || mobileTab !== "expenses"}><ExpensesReport salesmen={salesmen} /></div>}
      {tasksVisited && <div hidden={desktopSection !== "tasks"}><TasksModal embedded active={desktopSection === "tasks"} /></div>}
      <AdminMobileNav active={mobileTab} onChange={switchMobileTab} />

      {showTeamActivity && <AdminTeamActivitySheet salesmen={salesmen} onClose={() => setShowTeamActivity(false)} />}
      {selectedLead && <LeadDetailDrawer lead={leads.find((l) => l.id === selectedLead.id) || selectedLead} onClose={() => setSelectedLead(null)} onStatusChange={onStatusChange} onUpdate={onUpdateLead} onDelete={onDeleteLead} fetchHistory={api.adminLeadHistory} isAdmin />}
      {routeSalesman && <SalesmanRouteModal salesman={routeSalesman} onClose={() => setRouteSalesman(null)} />}
      {showAdminAddLead && (
        <AdminAddLeadModalV2
          salesmen={salesmen}
          onClose={() => setShowAdminAddLead(false)}
          onSubmit={async (payload) => {
            await onAddLead(payload);
            showSaveFeedback("Lead saved");
            setShowAdminAddLead(false);
          }}
        />
      )}
      {viewingSalesmanLeads && (
        <SalesmanLeadsModal
          salesman={viewingSalesmanLeads}
          leads={leads}
          onClose={() => setViewingSalesmanLeads(null)}
          onSelectLead={(l) => { setViewingSalesmanLeads(null); setSelectedLead(l); }}
        />
      )}
      {showAddSalesman && (
        <SalesmanFormModal
          existingCount={salesmen.length}
          onClose={() => setShowAddSalesman(false)}
          onSubmit={async (s) => { await onAddSalesman(s); setShowAddSalesman(false); }}
        />
      )}
      {briefSalesman && <SalesmanBriefPopup key={briefSalesman.id} salesman={briefSalesman} onClose={()=>setBriefSalesman(null)} />}
      {employeeSettings && <EmployeeSettings employee={employeeSettings} isActive={salesmen.find(x=>x.id===employeeSettings.id)?.isActive!==false} onToggleActive={()=>onToggleSalesmanActive(employeeSettings.id, salesmen.find(x=>x.id===employeeSettings.id)?.isActive===false)} onClose={()=>setEmployeeSettings(null)} onEdit={()=>{setEditSalesman(employeeSettings);setEmployeeSettings(null)}} onDelete={()=>{setDeleteSalesmanConfirm(employeeSettings);setEmployeeSettings(null)}} />}
      {editSalesman && (
        <SalesmanFormModal
          salesman={editSalesman}
          onClose={() => setEditSalesman(null)}
          onSubmit={async (payload) => { await onEditSalesman(editSalesman.id, payload); setEditSalesman(null); }}
        />
      )}
      {deleteSalesmanConfirm && (
        <Overlay onClose={() => { setDeleteSalesmanConfirm(null); setDeleteSalesmanError(""); }} title={`Delete ${deleteSalesmanConfirm.name}?`}>
          <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 14 }}>
            This permanently removes their account. If they still have any leads, this will be blocked — delete those first.
          </div>
          {deleteSalesmanError && (
            <div style={{ fontSize: 12.5, color: T.danger, background: T.dangerSoft, borderRadius: 11, padding: "8px 10px", marginBottom: 12 }}>{deleteSalesmanError}</div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setDeleteSalesmanConfirm(null); setDeleteSalesmanError(""); }} style={{ flex: 1, padding: 10, borderRadius: 11, border: `1px solid ${T.line}`, background: "#fff", color: T.ink, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button
              onClick={async () => {
                try {
                  await onDeleteSalesman(deleteSalesmanConfirm.id);
                  setDeleteSalesmanConfirm(null);
                  setDeleteSalesmanError("");
                } catch (err) {
                  setDeleteSalesmanError(err instanceof ApiError ? err.message : "Couldn't delete this employee.");
                }
              }}
              style={{ flex: 1, padding: 10, borderRadius: 11, border: "none", background: T.danger, color: "#fff", fontWeight: 700, cursor: "pointer" }}
            >
              Delete permanently
            </button>
          </div>
        </Overlay>
      )}
      {statLeadsModal && (
        <MyLeadsModal
          leads={statLeadsModal.leads}
          title={statLeadsModal.title}
          onClose={() => setStatLeadsModal(null)}
          onSelectLead={(l) => { setStatLeadsModal(null); setSelectedLead(l); }}
        />
      )}
      {messageTarget && (
        <MessageComposeModal
          salesman={messageTarget === "all" ? null : messageTarget}
          onClose={() => setMessageTarget(null)}
          onSend={(body) => api.adminSendMessage({ recipientId: messageTarget === "all" ? null : messageTarget.id, body })}
        />
      )}
      </>
      )}
    </div>
  );
}


  return { LiveMap, AdminApp, AdminView };
}
