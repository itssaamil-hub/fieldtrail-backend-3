import React, { useEffect, useMemo, useState } from "react";
import { LayoutGrid, List, Plus, Search, X } from "lucide-react";
import DesktopContacts from "../DesktopContacts.jsx";
import MobileContacts from "../MobileContacts.jsx";
import DesktopDealsBoard from "../DesktopDealsBoard";
import { api, buildExportUrl } from "../api.js";
import useAdminLeadPage from "./useAdminLeadPage.js";

const MOBILE_STATUS_STYLE = {
  cold: { background: "#F3F4F6", color: "#4B5563", border: "#E2E5E9" },
  conversation: { background: "#EAF1FF", color: "#315FB4", border: "#D8E3FA" },
  hot: { background: "#FDECEC", color: "#C33F3F", border: "#F4D2D2" },
  demo: { background: "#F2ECFF", color: "#7350A5", border: "#E3D8FA" },
  negotiation: { background: "#FFF4DA", color: "#A06B12", border: "#F0D69A" },
  won: { background: "#E6F6EF", color: "#12805C", border: "#CFE9DE" },
  lost: { background: "#F4F4F5", color: "#71717A", border: "#E4E4E7" },
  nurture: { background: "#EAF6F8", color: "#287C88", border: "#D7EBEF" },
};

const PIPELINE_DATE_OPTIONS = [
  ["all", "Date: All time"],
  ["today", "Today"],
  ["this_week", "This week"],
  ["last_7", "Last 7 days"],
  ["last_15", "Last 15 days"],
  ["this_month", "This month"],
  ["last_month", "Last month"],
  ["custom", "Custom range"],
];

const IST_DAY_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
});

function istDayKey(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return IST_DAY_FORMAT.format(date);
}

function shiftDay(key, days) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function pipelineDateRange(preset, customFrom, customTo) {
  if (!preset || preset === "all") return null;
  const today = istDayKey(new Date());
  if (preset === "today") return { from: today, to: today };
  if (preset === "last_7") return { from: shiftDay(today, -6), to: today };
  if (preset === "last_15") return { from: shiftDay(today, -14), to: today };
  if (preset === "this_week") {
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
    const mondayOffset = (weekday + 6) % 7;
    return { from: shiftDay(today, -mondayOffset), to: today };
  }
  if (preset === "this_month") return { from: `${today.slice(0, 8)}01`, to: today };
  if (preset === "last_month") {
    const [year, month] = today.split("-").map(Number);
    const first = new Date(Date.UTC(year, month - 2, 1));
    const last = new Date(Date.UTC(year, month - 1, 0));
    return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
  }
  if (preset === "custom") return { from: customFrom || "", to: customTo || "" };
  return null;
}

function localDay(value) {
  if (!value) return null;
  const d = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function mobileAttention(lead) {
  if (lead.status === "won") return { label: "Won", tone: "#12805C" };
  if (lead.status === "lost") return { label: "Lost", tone: "#71717A" };
  if (!lead.nextFollowUpDate) return { label: "", tone: "#70817E" };
  const follow = localDay(`${String(lead.nextFollowUpDate).slice(0, 10)}T00:00:00`);
  const today = localDay(new Date());
  if (!follow || !today) return { label: "", tone: "#70817E" };
  const days = Math.round((follow - today) / 86400000);
  if (days < 0) return { label: "Follow-up overdue", tone: "#C33F3F" };
  if (days === 0) return { label: "Follow-up today", tone: "#A06B12" };
  if (days === 1) return { label: "Follow-up tomorrow", tone: "#287C88" };
  return { label: "", tone: "#70817E" };
}

export default function AdminLeadsPanel({
  showLeads, desktopDeals, desktopContacts, sectionNavigation, section, desktopSection, phone,
  salesmen, filteredLeads, pagedLeads, leadsViewMode, setLeadsViewMode,
  filterSalesman, setFilterSalesman, filterCity, setFilterCity, cityOptions = [], filterStatus, setFilterStatus, filterDate, setFilterDate,
  searchQuery, setSearchQuery, LEADS_PER_PAGE,
  onStatusChange, onSelectLead, onAddClick, shared,
}) {
  const {
    T, fmtMoney, Select, STATUSES, STATUS_LABEL, DownloadMenu, VerificationStamp,
    NoLocationBadge, LeadsBoardView, leadAvatarStyle, leadInitials, fmtTime,
  } = shared;
  const [sheetsInfo, setSheetsInfo] = useState(null);
  const [sheetsError, setSheetsError] = useState("");
  const [mobileDealsSort, setMobileDealsSort] = useState("recent_activity");
  const [pipelineDatePreset, setPipelineDatePreset] = useState("all");
  const [pipelineDateFrom, setPipelineDateFrom] = useState("");
  const [pipelineDateTo, setPipelineDateTo] = useState("");
  const [pipelinePage, setPipelinePage] = useState(1);
  const [contactsDatePreset, setContactsDatePreset] = useState("all");
  const [contactsDateFrom, setContactsDateFrom] = useState("");
  const [contactsDateTo, setContactsDateTo] = useState("");
  const [contactsPage, setContactsPage] = useState(1);

  useEffect(() => {
    if ((desktopDeals || desktopContacts) && filterDate) setFilterDate("");
  }, [desktopDeals, desktopContacts, filterDate, setFilterDate]);

  const pipelineRange = useMemo(
    () => pipelineDateRange(pipelineDatePreset, pipelineDateFrom, pipelineDateTo),
    [pipelineDatePreset, pipelineDateFrom, pipelineDateTo]
  );
  const pipelineFilteredLeads = useMemo(() => {
    if (!desktopDeals || !pipelineRange || (!pipelineRange.from && !pipelineRange.to)) return filteredLeads;
    return filteredLeads.filter((lead) => {
      const day = istDayKey(lead.createdAt);
      if (!day) return false;
      if (pipelineRange.from && day < pipelineRange.from) return false;
      if (pipelineRange.to && day > pipelineRange.to) return false;
      return true;
    });
  }, [desktopDeals, filteredLeads, pipelineRange]);

  const contactsRange = useMemo(
    () => pipelineDateRange(contactsDatePreset, contactsDateFrom, contactsDateTo),
    [contactsDatePreset, contactsDateFrom, contactsDateTo]
  );
  const contactsFilteredLeads = useMemo(() => {
    if (!desktopContacts || !contactsRange || (!contactsRange.from && !contactsRange.to)) return filteredLeads;
    return filteredLeads.filter((lead) => {
      const day = istDayKey(lead.createdAt);
      if (!day) return false;
      if (contactsRange.from && day < contactsRange.from) return false;
      if (contactsRange.to && day > contactsRange.to) return false;
      return true;
    });
  }, [desktopContacts, filteredLeads, contactsRange]);

  const displayLeads = desktopDeals ? pipelineFilteredLeads : desktopContacts ? contactsFilteredLeads : filteredLeads;
  const pipelineDateActive = Boolean(desktopDeals && pipelineRange && (pipelineRange.from || pipelineRange.to));
  const contactsDateActive = Boolean(desktopContacts && contactsRange && (contactsRange.from || contactsRange.to));
  const rangeDateActive = pipelineDateActive || contactsDateActive;
  const cityFilterActive = Boolean(filterCity.trim());
  const localFilterActive = rangeDateActive || cityFilterActive;

  useEffect(() => {
    setPipelinePage(1);
  }, [pipelineDatePreset, pipelineDateFrom, pipelineDateTo, filterSalesman, filterCity, filterStatus, searchQuery]);

  useEffect(() => {
    setContactsPage(1);
  }, [contactsDatePreset, contactsDateFrom, contactsDateTo, filterSalesman, filterCity, filterStatus, searchQuery]);

  const mobileDeals = Boolean(phone && sectionNavigation && section === "deals" && !desktopSection);
  const mobileDealRows = useMemo(() => {
    if (!mobileDeals) return filteredLeads;
    const rows = [...filteredLeads];
    const activity = (lead) => new Date(lead.updatedAt || lead.createdAt || 0).getTime();
    if (mobileDealsSort === "oldest_activity") rows.sort((a, b) => activity(a) - activity(b));
    else if (mobileDealsSort === "newest_lead") rows.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    else if (mobileDealsSort === "oldest_lead") rows.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    else rows.sort((a, b) => activity(b) - activity(a));
    return rows;
  }, [filteredLeads, mobileDeals, mobileDealsSort]);

  const listMode = (sectionNavigation && section === "leads")
    || ((desktopDeals || !(sectionNavigation && section === "deals")) && leadsViewMode === "list");
  const refreshKey = `${filteredLeads.length}:${filteredLeads[0]?.id || ""}:${filteredLeads[0]?.status || ""}`;
  const serverPage = useAdminLeadPage({
    enabled: showLeads && listMode && !localFilterActive,
    salesmanId: filterSalesman,
    status: filterStatus,
    date: filterDate,
    search: searchQuery,
    limit: LEADS_PER_PAGE,
    refreshKey,
  });

  const localById = useMemo(() => new Map(filteredLeads.map((lead) => [lead.id, lead])), [filteredLeads]);
  const serverRows = useMemo(
    () => serverPage.rows.map((lead) => localById.get(lead.id) || lead),
    [serverPage.rows, localById]
  );
  const rangeFilteredLeads = pipelineDateActive ? pipelineFilteredLeads : contactsDateActive ? contactsFilteredLeads : filteredLeads;
  const rangePage = pipelineDateActive ? pipelinePage : contactsPage;
  const rangeTotalPages = Math.max(1, Math.ceil(rangeFilteredLeads.length / LEADS_PER_PAGE));
  const rangeCurrentPage = Math.min(rangePage, rangeTotalPages);
  const rangePagedRows = rangeFilteredLeads.slice((rangeCurrentPage - 1) * LEADS_PER_PAGE, rangeCurrentPage * LEADS_PER_PAGE);
  const listRows = localFilterActive ? rangePagedRows : (serverPage.loading && serverRows.length === 0 ? pagedLeads : serverRows);
  const listTotal = localFilterActive ? rangeFilteredLeads.length : (serverPage.error && serverRows.length === 0 ? filteredLeads.length : serverPage.total);
  const listTotalPages = localFilterActive ? rangeTotalPages : (serverPage.error && serverRows.length === 0
    ? Math.max(1, Math.ceil(filteredLeads.length / LEADS_PER_PAGE))
    : serverPage.totalPages);
  const listCurrentPage = localFilterActive ? rangeCurrentPage : (serverPage.error && serverRows.length === 0 ? 1 : serverPage.page);
  const listLoading = localFilterActive ? false : serverPage.loading;
  const setListPage = localFilterActive ? (desktopDeals ? setPipelinePage : setContactsPage) : serverPage.setPage;

  if (mobileDeals) {
    const mobileTotalValue = mobileDealRows.reduce((sum, lead) => sum + (Number(lead.dealValue) || 0), 0);
    const controlStyle = {
      minWidth: 0,
      height: 34,
      border: `1px solid ${T.line}`,
      borderRadius: 9,
      background: "#fff",
      color: T.ink,
      padding: "5px 9px",
      fontSize: 11.5,
      fontWeight: 650,
      outline: "none",
    };

    return (
      <div hidden={!showLeads} style={{ marginTop: 8 }}>
        <section aria-label="Admin deals" style={{ width: "100%" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, lineHeight: 1.2, color: T.ink }}>Deals</h2>
              <div style={{ marginTop: 3, fontSize: 11.5, color: T.inkSoft }}>
                {mobileDealRows.length} deals · {fmtMoney(mobileTotalValue)} recorded value
              </div>
            </div>
            {onAddClick && (
              <button
                type="button"
                onClick={onAddClick}
                aria-label="Add Deal"
                style={{ flexShrink: 0, minHeight: 34, display: "inline-flex", alignItems: "center", gap: 5, border: "none", borderRadius: 9, padding: "7px 10px", background: T.route, color: "#fff", fontSize: 11.5, fontWeight: 800, cursor: "pointer" }}
              >
                <Plus size={14} /> Add Deal
              </button>
            )}
          </div>

          <div style={{ position: "relative", marginBottom: 9 }}>
            <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: T.inkSoft, pointerEvents: "none" }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search deals"
              placeholder="Search deals"
              style={{ width: "100%", height: 38, padding: "8px 34px 8px 33px", borderRadius: 10, border: `1px solid ${T.line}`, background: "#fff", color: T.ink, fontSize: 13, outline: "none" }}
            />
            {searchQuery && (
              <button type="button" aria-label="Clear search" onClick={() => setSearchQuery("")} style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "none", background: "transparent", color: T.inkSoft, cursor: "pointer" }}>
                <X size={14} />
              </button>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 7, marginBottom: 7 }}>
            <div>
              <input aria-label="City filter" list="engage-city-filter-mobile" value={filterCity} onChange={(e) => setFilterCity(e.target.value)} placeholder="All cities" style={{ ...controlStyle, width: "100%" }} />
              <datalist id="engage-city-filter-mobile">{cityOptions.map((city) => <option key={city} value={city} />)}</datalist>
            </div>
            <select aria-label="Employee" value={filterSalesman} onChange={(e) => setFilterSalesman(e.target.value)} style={controlStyle}>
              <option value="all">All employees</option>
              {salesmen.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select aria-label="Deal status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={controlStyle}>
              <option value="all">Status</option>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <input aria-label="Deal date" type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{ ...controlStyle, width: "100%" }} />
            <select aria-label="Sort deals" value={mobileDealsSort} onChange={(e) => setMobileDealsSort(e.target.value)} style={controlStyle}>
              <option value="recent_activity">Recent activity</option>
              <option value="oldest_activity">Oldest activity</option>
              <option value="newest_lead">Newest deal</option>
              <option value="oldest_lead">Oldest deal</option>
            </select>
          </div>

          {(filterSalesman !== "all" || filterCity.trim() || filterStatus !== "all" || filterDate || searchQuery.trim()) && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
              <button type="button" onClick={() => { setFilterSalesman("all"); setFilterCity(""); setFilterStatus("all"); setFilterDate(""); setSearchQuery(""); }} style={{ border: "none", background: "transparent", color: T.route, fontSize: 11, fontWeight: 800, padding: "3px 1px", cursor: "pointer" }}>
                Reset filters
              </button>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {mobileDealRows.map((lead) => {
              const statusStyle = MOBILE_STATUS_STYLE[lead.status] || MOBILE_STATUS_STYLE.cold;
              const attention = mobileAttention(lead);
              const activityTime = lead.updatedAt || lead.createdAt;
              return (
                <button
                  key={lead.id}
                  type="button"
                  className="ft-row"
                  onClick={() => onSelectLead(lead)}
                  style={{ width: "100%", textAlign: "left", border: `1px solid ${T.line}`, borderRadius: 12, background: "#fff", padding: "10px 11px", cursor: "pointer", color: T.ink }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 9 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.25, overflowWrap: "anywhere" }}>{lead.business}</div>
                      <div style={{ marginTop: 3, display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", fontSize: 11.2, color: T.inkSoft }}>
                        <span>{lead.salesmanName || "Unassigned"}</span>
                        {attention.label && <><span aria-hidden="true">·</span><strong style={{ color: attention.tone, fontWeight: 800 }}>{attention.label}</strong></>}
                      </div>
                    </div>
                    <span style={{ flexShrink: 0, border: `1px solid ${statusStyle.border}`, borderRadius: 999, background: statusStyle.background, color: statusStyle.color, padding: "4px 8px", fontSize: 10.5, lineHeight: 1, fontWeight: 800 }}>
                      {STATUS_LABEL[lead.status] || lead.status}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10, marginTop: 8 }}>
                    <div style={{ minWidth: 0, fontSize: 10.8, color: T.inkSoft, lineHeight: 1.3 }}>
                      {[lead.subLocation, lead.owner || lead.phone].filter(Boolean).join(" · ") || "No contact details"}
                      <div style={{ marginTop: 2 }}>{activityTime ? fmtTime(activityTime) : ""}</div>
                    </div>
                    {lead.dealValue != null && Number(lead.dealValue) > 0 && (
                      <div style={{ flexShrink: 0, fontSize: 12, fontWeight: 850, color: T.route }}>{fmtMoney(Number(lead.dealValue))}</div>
                    )}
                  </div>
                </button>
              );
            })}
            {mobileDealRows.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, color: T.inkSoft, fontSize: 12.5, padding: "30px 8px" }}>
                <List size={20} style={{ opacity: 0.45 }} />
                No deals match these filters.
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  const dateInputStyle = { border: `1px solid ${T.line}`, borderRadius: 6, padding: "6px 8px", fontSize: 12.5, fontFamily: "Inter, sans-serif", background: "#fff", color: T.ink };
  const pipelineHasDateFilter = pipelineDatePreset !== "all";
  const contactsHasDateFilter = contactsDatePreset !== "all";

  return (
    <div hidden={!showLeads}>
      <div className={`ft-card${desktopDeals ? " engage-desktop-deals" : desktopContacts ? " engage-desktop-contacts" : ""}`} style={{ marginTop: 20, background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div>
            <div className={desktopDeals ? "engage-deals-title" : desktopContacts ? "engage-contacts-heading" : undefined} style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}>
              {sectionNavigation && section === "deals" ? (desktopSection ? "Pipeline" : "Deals") : (desktopContacts || (phone && section === "leads")) ? "Contacts" : "Leads"}
            </div>
            {(desktopContacts || (phone && section === "leads")) && <div className="engage-contacts-summary">{listMode ? listTotal : filteredLeads.length} contact records · Your restaurant connections</div>}
            {desktopDeals && <div className="engage-deals-summary">{listMode ? listTotal : displayLeads.length} deals · {fmtMoney(displayLeads.reduce((sum, lead) => sum + (Number(lead.dealValue) || 0), 0))} recorded value</div>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: sectionNavigation && section !== "dashboard" && !desktopDeals ? "none" : "flex", gap: 2, background: T.paperDeep, borderRadius: 8, padding: 2 }}>
              <button
                onClick={() => setLeadsViewMode("list")}
                style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: leadsViewMode === "list" ? "#fff" : "transparent", color: leadsViewMode === "list" ? T.ink : T.inkSoft, boxShadow: leadsViewMode === "list" ? "0 1px 2px rgba(20,20,30,0.08)" : "none" }}
              >
                <List size={13} /> List
              </button>
              <button
                onClick={() => setLeadsViewMode("board")}
                style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: leadsViewMode === "board" ? "#fff" : "transparent", color: leadsViewMode === "board" ? T.ink : T.inkSoft, boxShadow: leadsViewMode === "board" ? "0 1px 2px rgba(20,20,30,0.08)" : "none" }}
              >
                <LayoutGrid size={13} /> Board
              </button>
            </div>
            {onAddClick && (
              <button
                onClick={onAddClick}
                title="Add lead"
                className={desktopDeals ? "engage-deals-add" : desktopContacts ? "engage-contacts-add" : undefined}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, border: "none", cursor: "pointer", background: T.route, color: "#fff" }}
              >
                <Plus size={16} />{(desktopDeals || desktopContacts) && "Add Lead"}
              </button>
            )}
          </div>
        </div>

        <div style={{ position: "relative", marginBottom: 12 }}>
          <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: T.inkSoft }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={desktopContacts ? "Search contacts" : "Search leads"}
            placeholder={desktopContacts ? "Search by contact, company, phone, or area…" : "Search leads by business, contact, phone, or area…"}
            style={{ width: "100%", padding: "9px 12px 9px 32px", borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 13.5, boxSizing: "border-box" }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", color: T.inkSoft }}>
              <X size={14} />
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {(desktopDeals || desktopContacts || (phone && section === "leads")) && <div style={{ position: "relative" }}>
              <input
                aria-label="City filter"
                list="engage-city-filter"
                value={filterCity}
                onChange={(e) => setFilterCity(e.target.value)}
                placeholder="All cities"
                style={{ ...dateInputStyle, minWidth: 132, paddingRight: filterCity ? 28 : 8 }}
              />
              <datalist id="engage-city-filter">{cityOptions.map((city) => <option key={city} value={city} />)}</datalist>
              {filterCity && <button type="button" aria-label="Clear city filter" onClick={() => setFilterCity("")} style={{ position: "absolute", right: 5, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", color: T.inkSoft, cursor: "pointer", padding: 2 }}><X size={12} /></button>}
            </div>}
            <Select value={filterSalesman} onChange={setFilterSalesman} options={[["all", "All employees"], ...salesmen.map((s) => [s.id, s.name])]} />
            <Select value={filterStatus} onChange={setFilterStatus} options={[["all", "All statuses"], ...STATUSES.map((s) => [s, STATUS_LABEL[s]])]} />
            {desktopDeals ? (
              <>
                <Select value={pipelineDatePreset} onChange={setPipelineDatePreset} options={PIPELINE_DATE_OPTIONS} />
                {pipelineDatePreset === "custom" && (
                  <>
                    <input aria-label="Pipeline date from" title="From" type="date" value={pipelineDateFrom} onChange={(e) => setPipelineDateFrom(e.target.value)} style={dateInputStyle} />
                    <input aria-label="Pipeline date to" title="To" type="date" value={pipelineDateTo} min={pipelineDateFrom || undefined} onChange={(e) => setPipelineDateTo(e.target.value)} style={dateInputStyle} />
                  </>
                )}
              </>
            ) : desktopContacts ? (
              <>
                <Select value={contactsDatePreset} onChange={setContactsDatePreset} options={PIPELINE_DATE_OPTIONS} />
                {contactsDatePreset === "custom" && (
                  <>
                    <input aria-label="Contacts date from" title="From" type="date" value={contactsDateFrom} onChange={(e) => setContactsDateFrom(e.target.value)} style={dateInputStyle} />
                    <input aria-label="Contacts date to" title="To" type="date" value={contactsDateTo} min={contactsDateFrom || undefined} onChange={(e) => setContactsDateTo(e.target.value)} style={dateInputStyle} />
                  </>
                )}
              </>
            ) : (
              <>
                <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={dateInputStyle} />
                {filterDate && (
                  <button onClick={() => setFilterDate("")} style={{ fontSize: 11.5, color: T.inkSoft, background: "none", border: "none", cursor: "pointer", padding: "6px 4px" }}>
                    Clear date
                  </button>
                )}
              </>
            )}
            {(filterSalesman !== "all" || filterCity.trim() || filterStatus !== "all" || filterDate || (desktopDeals && pipelineHasDateFilter) || (desktopContacts && contactsHasDateFilter) || searchQuery.trim()) && (
              <button
                type="button"
                onClick={() => { setFilterSalesman("all"); setFilterCity(""); setFilterStatus("all"); setFilterDate(""); setPipelineDatePreset("all"); setPipelineDateFrom(""); setPipelineDateTo(""); setContactsDatePreset("all"); setContactsDateFrom(""); setContactsDateTo(""); setSearchQuery(""); }}
                style={{ fontSize: 11.5, color: T.route, background: "#EAF5F0", border: `1px solid ${T.line}`, borderRadius: 8, cursor: "pointer", padding: "6px 9px", fontWeight: 750 }}
              >
                Reset filters
              </button>
            )}
            <DownloadMenu
              onCsv={() => window.open(buildExportUrl("csv", { salesmanId: filterSalesman, status: filterStatus, date: filterDate }), "_blank")}
              onXlsx={() => window.open(buildExportUrl("xlsx", { salesmanId: filterSalesman, status: filterStatus, date: filterDate }), "_blank")}
              onSheets={async () => {
                setSheetsError("");
                try {
                  const info = await api.adminExportSheetsInfo({ salesmanId: filterSalesman, status: filterStatus, date: filterDate });
                  setSheetsInfo(info);
                } catch (err) {
                  setSheetsError(err.message || "Couldn't prepare the Sheets export.");
                }
              }}
            />
          </div>
        </div>

        {sheetsError && <div style={{ fontSize: 12, color: T.danger, marginBottom: 10 }}>{sheetsError}</div>}
        {sheetsInfo && (
          <div style={{ fontSize: 12, background: T.paperDeep, borderRadius: 11, padding: "10px 12px", marginBottom: 12 }}>
            No Google account is connected, so this can't push directly into a Sheet — but you can pull it in live:
            open a new Google Sheet, put this formula in cell A1, and re-enter it anytime to refresh:
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", background: "#fff", border: `1px solid ${T.line}`, borderRadius: 6, padding: "6px 8px", marginTop: 6, wordBreak: "break-all" }}>
              {sheetsInfo.importFormula}
            </div>
            <button onClick={() => { navigator.clipboard?.writeText(sheetsInfo.importFormula); }} style={{ marginTop: 8, fontSize: 11.5, fontWeight: 600, color: T.route, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              Copy formula
            </button>
          </div>
        )}

        {serverPage.error && listMode && !localFilterActive && <div style={{ fontSize: 12, color: T.danger, marginBottom: 10 }}>{serverPage.error}</div>}

        {listMode ? (
          <>
            {phone && section === "leads" ? (
              <MobileContacts leads={listRows} onSelectLead={onSelectLead} renderVerification={l => l.hasLocation ? <VerificationStamp status={l.verification} small /> : <NoLocationBadge small />} />
            ) : desktopContacts ? (
              <DesktopContacts leads={listRows} onSelectLead={onSelectLead} renderVerification={l => l.hasLocation ? <VerificationStamp status={l.verification} small /> : <NoLocationBadge small />} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {listRows.map((l) => (
                  <div key={l.id} className="ft-row" onClick={() => onSelectLead(l)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", border: `1px solid ${T.line}`, borderRadius: 11, cursor: "pointer", background: "#fff" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <div aria-hidden="true" style={leadAvatarStyle(l.business)}>{leadInitials(l.business)}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{l.business}</div>
                        <div style={{ fontSize: 12, color: T.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
                          {l.salesmanName} · {fmtTime(l.createdAt)}{l.hasLocation ? ` · ${l.lat.toFixed(5)}, ${l.lng.toFixed(5)}` : ""}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                      {l.hasLocation ? <VerificationStamp status={l.verification} small /> : <NoLocationBadge small />}
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.route, background: "#EEF1FD", padding: "5px 12px", borderRadius: 999 }}>{STATUS_LABEL[l.status]}</span>
                    </div>
                  </div>
                ))}
                {!listLoading && listTotal === 0 && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: T.inkSoft, fontSize: 13, padding: "36px 8px" }}>
                    <List size={22} style={{ opacity: 0.5 }} />
                    No leads match these filters.
                  </div>
                )}
              </div>
            )}

            {listTotal > LEADS_PER_PAGE && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.line}` }}>
                <div style={{ fontSize: 12, color: T.inkSoft }}>
                  Showing {(listCurrentPage - 1) * LEADS_PER_PAGE + 1}–{Math.min(listCurrentPage * LEADS_PER_PAGE, listTotal)} of {listTotal}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    disabled={listCurrentPage <= 1 || listLoading}
                    onClick={() => setListPage((p) => Math.max(1, p - 1))}
                    style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${T.line}`, background: "#fff", color: T.ink, fontWeight: 700, fontSize: 12.5, cursor: listCurrentPage <= 1 || listLoading ? "not-allowed" : "pointer", opacity: listCurrentPage <= 1 || listLoading ? 0.5 : 1 }}
                  >
                    Previous
                  </button>
                  <span style={{ fontSize: 12.5, color: T.inkSoft }}>Page {listCurrentPage} of {listTotalPages}</span>
                  <button
                    disabled={listCurrentPage >= listTotalPages || listLoading}
                    onClick={() => setListPage((p) => Math.min(listTotalPages, p + 1))}
                    style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${T.line}`, background: "#fff", color: T.ink, fontWeight: 700, fontSize: 12.5, cursor: listCurrentPage >= listTotalPages || listLoading ? "not-allowed" : "pointer", opacity: listCurrentPage >= listTotalPages || listLoading ? 0.5 : 1 }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          desktopDeals
            ? <DesktopDealsBoard leads={displayLeads} visibleStatus={filterStatus} onStatusChange={onStatusChange} onSelectLead={onSelectLead} />
            : <LeadsBoardView leads={filteredLeads} onStatusChange={onStatusChange} onSelectLead={onSelectLead} />
        )}
      </div>
    </div>
  );
}