import React, { useState } from "react";
import { LayoutGrid, List, Plus, Search, X } from "lucide-react";
import DesktopContacts from "../DesktopContacts.jsx";
import MobileContacts from "../MobileContacts.jsx";
import DesktopDealsBoard from "../DesktopDealsBoard";
import { api, buildExportUrl } from "../api.js";

export default function AdminLeadsPanel({
  showLeads, desktopDeals, desktopContacts, sectionNavigation, section, desktopSection, phone,
  salesmen, filteredLeads, pagedLeads, leadsViewMode, setLeadsViewMode,
  filterSalesman, setFilterSalesman, filterStatus, setFilterStatus, filterDate, setFilterDate,
  searchQuery, setSearchQuery, LEADS_PER_PAGE, currentPage, setLeadsPage, totalPages,
  onStatusChange, onSelectLead, onAddClick, shared,
}) {
  const {
    T, fmtMoney, Select, STATUSES, STATUS_LABEL, DownloadMenu, VerificationStamp,
    NoLocationBadge, LeadsBoardView, leadAvatarStyle, leadInitials, fmtTime,
  } = shared;
  const [sheetsInfo, setSheetsInfo] = useState(null);
  const [sheetsError, setSheetsError] = useState("");

  return (
      <div hidden={!showLeads}>
      <div className={`ft-card${desktopDeals ? " engage-desktop-deals" : desktopContacts ? " engage-desktop-contacts" : ""}`} style={{ marginTop: 20, background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div><div className={desktopDeals ? "engage-deals-title" : desktopContacts ? "engage-contacts-heading" : undefined} style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}>{sectionNavigation && section === "deals" ? (desktopSection ? "Pipeline" : "Deals") : (desktopContacts || (phone && section === "leads")) ? "Contacts" : "Leads"}</div>{(desktopContacts || (phone && section === "leads")) && <div className="engage-contacts-summary">{filteredLeads.length} contact records · Your restaurant connections</div>}{desktopDeals && <div className="engage-deals-summary">{filteredLeads.length} deals · {fmtMoney(filteredLeads.reduce((sum, lead) => sum + (Number(lead.dealValue) || 0), 0))} recorded value</div>}</div>
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
            <Select value={filterSalesman} onChange={setFilterSalesman} options={[["all", "All employees"], ...salesmen.map((s) => [s.id, s.name])]} />
            <Select value={filterStatus} onChange={setFilterStatus} options={[["all", "All statuses"], ...STATUSES.map((s) => [s, STATUS_LABEL[s]])]} />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              style={{ border: `1px solid ${T.line}`, borderRadius: 6, padding: "6px 8px", fontSize: 12.5, fontFamily: "Inter, sans-serif", background: "#fff", color: T.ink }}
            />
            {filterDate && (
              <button onClick={() => setFilterDate("")} style={{ fontSize: 11.5, color: T.inkSoft, background: "none", border: "none", cursor: "pointer", padding: "6px 4px" }}>
                Clear date
              </button>
            )}
            {(filterSalesman !== "all" || filterStatus !== "all" || filterDate || searchQuery.trim()) && (
              <button
                type="button"
                onClick={() => { setFilterSalesman("all"); setFilterStatus("all"); setFilterDate(""); setSearchQuery(""); }}
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

        {(sectionNavigation && section === "leads") || ((desktopDeals || !(sectionNavigation && section === "deals")) && leadsViewMode === "list") ? (
          <>
        {phone && section === "leads" ? <MobileContacts leads={pagedLeads} onSelectLead={onSelectLead} renderVerification={l=>l.hasLocation ? <VerificationStamp status={l.verification} small /> : <NoLocationBadge small />} /> : desktopContacts ? <DesktopContacts leads={pagedLeads} onSelectLead={onSelectLead} renderVerification={l=>l.hasLocation ? <VerificationStamp status={l.verification} small /> : <NoLocationBadge small />} /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {pagedLeads.map((l) => (
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
          {filteredLeads.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: T.inkSoft, fontSize: 13, padding: "36px 8px" }}>
              <List size={22} style={{ opacity: 0.5 }} />
              No leads match these filters.
            </div>
          )}
        </div>
        )}

        {filteredLeads.length > LEADS_PER_PAGE && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.line}` }}>
            <div style={{ fontSize: 12, color: T.inkSoft }}>
              Showing {(currentPage - 1) * LEADS_PER_PAGE + 1}–{Math.min(currentPage * LEADS_PER_PAGE, filteredLeads.length)} of {filteredLeads.length}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                disabled={currentPage <= 1}
                onClick={() => setLeadsPage((p) => Math.max(1, p - 1))}
                style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${T.line}`, background: "#fff", color: T.ink, fontWeight: 700, fontSize: 12.5, cursor: currentPage <= 1 ? "not-allowed" : "pointer", opacity: currentPage <= 1 ? 0.5 : 1 }}
              >
                Previous
              </button>
              <span style={{ fontSize: 12.5, color: T.inkSoft }}>Page {currentPage} of {totalPages}</span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setLeadsPage((p) => Math.min(totalPages, p + 1))}
                style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${T.line}`, background: "#fff", color: T.ink, fontWeight: 700, fontSize: 12.5, cursor: currentPage >= totalPages ? "not-allowed" : "pointer", opacity: currentPage >= totalPages ? 0.5 : 1 }}
              >
                Next
              </button>
            </div>
          </div>
        )}
          </>
        ) : (
          desktopDeals ? <DesktopDealsBoard leads={filteredLeads} visibleStatus={filterStatus} onStatusChange={onStatusChange} onSelectLead={onSelectLead} /> : <LeadsBoardView leads={filteredLeads} onStatusChange={onStatusChange} onSelectLead={onSelectLead} />
        )}
      </div>

      </div>
  );
}
