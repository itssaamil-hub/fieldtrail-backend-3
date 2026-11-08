import React, { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { Flame, MessageCircle, Handshake, Trophy, SlidersHorizontal, X, CalendarDays, ChevronRight } from "lucide-react";

const STAGES = [
  { id: "hot", label: "Moved to Hot", Icon: Flame, color: "#C75C30" },
  { id: "conversation", label: "Moved to Conversation", Icon: MessageCircle, color: "#267B88" },
  { id: "negotiation", label: "Moved to Negotiation", Icon: Handshake, color: "#7B4FC9" },
  { id: "won", label: "Moved to Won", Icon: Trophy, color: "#12805C" },
];

function currentIstMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit",
  }).formatToParts(new Date());
  return parts.find(part => part.type === "year").value + "-" +
    parts.find(part => part.type === "month").value;
}

function monthLabel(month) {
  return new Intl.DateTimeFormat("en-IN", {
    month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(month + "-01T00:00:00Z"));
}

function eventTime(value) {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit",
  }).format(new Date(value));
}

function stageLabel(stage) {
  const labels = { hot:"Hot", conversation:"Conversation", negotiation:"Negotiation",
    won:"Won", cold:"Cold", demo:"Demo", lost:"Lost", nurture:"Nurture" };
  return labels[stage] || (stage ? String(stage).replaceAll("_", " ") : "Unknown");
}

export default function StageMovementReport({ salesmen = [], T }) {
  const [month, setMonth] = useState(currentIstMonth);
  const [salesmanId, setSalesmanId] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const popoverRef = useRef(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedStage, setSelectedStage] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState("");
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  useEffect(() => {
    if (!filterOpen) return undefined;
    const outside = event => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) setFilterOpen(false);
    };
    const escape = event => {
      if (event.key === "Escape") setFilterOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [filterOpen]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setReport(null);
    setError("");
    api.stageMovementReport({month, ...(salesmanId === "all" ? {} : {salesmanId})})
      .then(data => { if (!cancelled) setReport(data); })
      .catch(err => { if (!cancelled) setError(err.message || "Couldn't load stage movements."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month, salesmanId]);

  useEffect(() => {
    if (!selectedStage) return undefined;
    let cancelled = false;
    setEventsLoading(true);
    setEventsError("");
    api.stageMovementEvents({
      month, stage: selectedStage, page, limit: 50,
      ...(salesmanId === "all" ? {} : {salesmanId}),
    })
      .then(data => {
        if (cancelled) return;
        setEvents(previous => page === 1 ? (data.events || []) : [...previous, ...(data.events || [])]);
        setHasNext(data.hasNext === true);
      })
      .catch(err => { if (!cancelled) setEventsError(err.message || "Couldn't load movement details."); })
      .finally(() => { if (!cancelled) setEventsLoading(false); });
    return () => { cancelled = true; };
  }, [month, salesmanId, selectedStage, page]);

  const changeFilter = (nextMonth, nextSalesman) => {
    setSelectedStage(null);
    setEvents([]);
    setPage(1);
    setHasNext(false);
    setMonth(nextMonth);
    setSalesmanId(nextSalesman);
  };

  const chooseStage = id => {
    setSelectedStage(previous => previous === id ? null : id);
    setEvents([]);
    setPage(1);
    setHasNext(false);
    setEventsError("");
  };

  const filteredName = salesmanId === "all"
    ? "All Team"
    : salesmen.find(person => String(person.id) === String(salesmanId))?.name ||
      report?.employees?.find(person => person.salesmanId === salesmanId)?.employeeName ||
      "Selected employee";

  const inputStyle = {
    width: "100%", height: 36, boxSizing: "border-box", background: "#fff",
    border: "1px solid " + T.line, borderRadius: 9, padding: "0 10px",
    fontSize: 12, color: T.ink, marginTop: 6,
  };

  return (
    <div style={{ width: "100%", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 13 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: T.inkSoft, fontSize: 12.5, lineHeight: 1.5 }}>
            See how your restaurant deals progressed during a month, even if their stage changed later.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 7, fontSize: 11.5, color: T.inkSoft }}>
            <CalendarDays size={13} />
            <span>{monthLabel(month)} · {filteredName}</span>
          </div>
        </div>
        <div ref={popoverRef} style={{ position: "relative", flexShrink: 0 }}>
          <button type="button" aria-label="Stage movement filters" title="Stage movement filters"
            aria-expanded={filterOpen} onClick={() => setFilterOpen(value => !value)}
            style={{ display: "grid", placeItems: "center", width: 36, height: 36,
              border: "1px solid " + T.line, background: "#fff", color: T.ink,
              borderRadius: 9, cursor: "pointer" }}>
            <SlidersHorizontal size={17}/>
          </button>
          {filterOpen && (
            <section aria-label="Stage movement filter options" style={{
              position: "absolute", top: 44, right: 0, zIndex: 150,
              width: "min(284px, calc(100vw - 44px))", boxSizing: "border-box",
              background: "#fff", border: "1px solid " + T.line, borderRadius: 13,
              padding: 15, boxShadow: "0 12px 32px rgba(22,37,48,.14)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 13 }}>
                <strong style={{ color: T.ink, fontSize: 13 }}>Report filters</strong>
                <button type="button" aria-label="Close stage movement filters" onClick={() => setFilterOpen(false)}
                  style={{ width: 27, height: 27, display: "grid", placeItems: "center",
                    border: 0, background: "transparent", color: T.inkSoft, cursor: "pointer" }}>
                  <X size={16}/>
                </button>
              </div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.inkSoft }}>
                Month & year
                <input aria-label="Stage movement month" type="month"
                  max={currentIstMonth()} min="2020-01" value={month}
                  onChange={event => event.target.value && changeFilter(event.target.value, salesmanId)}
                  style={inputStyle}/>
              </label>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.inkSoft, marginTop: 13 }}>
                Employee
                <select aria-label="Stage movement employee" value={salesmanId}
                  onChange={event => changeFilter(month, event.target.value)} style={inputStyle}>
                  <option value="all">All Team</option>
                  {salesmen.map(person =>
                    <option value={person.id} key={person.id}>{person.name || person.fullName || person.full_name}</option>
                  )}
                </select>
              </label>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
                <button type="button" onClick={() => changeFilter(currentIstMonth(), "all")}
                  style={{ border: 0, background: "none", color: T.inkSoft, cursor: "pointer", fontSize: 12 }}>Reset</button>
                <button type="button" onClick={() => setFilterOpen(false)}
                  style={{ border: 0, borderRadius: 8, padding: "7px 13px",
                    background: T.route, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Done</button>
              </div>
            </section>
          )}
        </div>
      </div>

      {error && <div role="alert" style={{ fontSize: 12.5, color: T.danger, marginBottom: 12 }}>{error}</div>}
      {loading && <div role="status" style={{ fontSize: 12, color: T.inkSoft, marginBottom: 10 }}>Loading stage movements…</div>}

      {report && !loading && (
        <>
          <div style={{ border: "1px solid " + T.line, borderRadius: 13, padding: "13px 15px",
            marginBottom: 10, background: T.card }}>
            <div style={{ fontSize: 11.5, color: T.inkSoft, fontWeight: 650 }}>Total stage entries</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: T.ink, marginTop: 2, lineHeight: 1.2 }}>
              {report.movements}
            </div>
            <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 5 }}>
              A deal can enter multiple stages; each deal is counted once per stage per month.
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 9, marginBottom: 14 }}>
            {STAGES.map(({id,label,Icon,color}) => (
              <button type="button" key={id} aria-pressed={selectedStage === id}
                onClick={() => chooseStage(id)}
                style={{ textAlign: "left", minWidth: 0, minHeight: 109,
                  padding: "11px 12px", cursor: "pointer",
                  borderRadius: 12, border: "1px solid " + (selectedStage === id ? T.route : T.line),
                  background: "#fff", color: T.ink }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Icon size={18} color={color}/>
                  <ChevronRight size={14} color={T.inkSoft}/>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, lineHeight: 1.15 }}>{report.totals?.[id] ?? 0}</div>
                <div style={{ fontSize: 11.5, fontWeight: 650, color: T.inkSoft, marginTop: 5 }}>{label}</div>
              </button>
            ))}
          </div>

          {selectedStage && (
            <section aria-label="Stage movement details" style={{ background: "#fff", border: "1px solid " + T.line,
              borderRadius: 13, padding: "13px 12px", marginBottom: 15 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                gap: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 750, color: T.ink }}>
                  {STAGES.find(stage => stage.id === selectedStage)?.label}
                </div>
                <button type="button" aria-label="Close movement details" onClick={() => chooseStage(selectedStage)}
                  style={{ border: 0, background: "transparent", color: T.inkSoft, cursor: "pointer" }}>
                  <X size={16}/>
                </button>
              </div>
              {eventsError && <div role="alert" style={{ fontSize: 12, color: T.danger, marginBottom: 8 }}>{eventsError}</div>}
              {events.map(event => (
                <div key={event.id} style={{ borderTop: "1px solid " + T.line, padding: "11px 0" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{event.businessName}</div>
                  <div style={{ marginTop: 4, fontSize: 11.5, color: T.inkSoft }}>
                    {stageLabel(event.previousStage)} → {stageLabel(event.stage)}
                    {" · "}{eventTime(event.occurredAt)}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11, color: T.inkSoft }}>
                    Now: <strong style={{ color: T.ink }}>{stageLabel(event.currentStatus)}</strong>
                    {" · "}Owner: {event.employeeName}
                  </div>
                  <div style={{ marginTop: 3, fontSize: 11, color: T.inkSoft }}>
                    Changed by: {event.changedByName}
                  </div>
                </div>
              ))}
              {eventsLoading && <div role="status" style={{ fontSize: 12, color: T.inkSoft, paddingTop: 6 }}>Loading movements…</div>}
              {!eventsLoading && !events.length && !eventsError && (
                <div style={{ fontSize: 12, color: T.inkSoft, padding: "12px 0" }}>
                  No recorded movements to this stage in the selected month.
                </div>
              )}
              {hasNext && !eventsLoading && !eventsError && (
                <button type="button" onClick={() => setPage(value => value + 1)}
                  style={{ cursor: "pointer", background: "#fff", border: "1px solid " + T.line,
                    borderRadius: 8, color: T.route, padding: "9px 13px", fontSize: 12, fontWeight: 700 }}>
                  Load more
                </button>
              )}
            </section>
          )}

          <div style={{ borderRadius: 13, border: "1px solid " + T.line, overflow: "hidden", background: "#fff" }}>
            <div style={{ fontSize: 13.5, fontWeight: 750, padding: "13px 12px 9px", color: T.ink }}>
              Employee performance
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(85px,2fr) repeat(4,minmax(37px,1fr))",
              padding: "9px 10px", gap: 4, background: "#F5F7F7", fontSize: 10, color: T.inkSoft, fontWeight: 750 }}>
              <span>Employee</span><span style={{textAlign:"center"}}>Hot</span>
              <span style={{textAlign:"center"}}>Conv.</span>
              <span style={{textAlign:"center"}}>Neg.</span>
              <span style={{textAlign:"center"}}>Won</span>
            </div>
            {report.employees?.map(person => (
              <button type="button" key={person.salesmanId}
                title={"Filter report to " + person.employeeName}
                onClick={() => { changeFilter(month, person.salesmanId); }}
                style={{ display: "grid",
                  gridTemplateColumns: "minmax(85px,2fr) repeat(4,minmax(37px,1fr))",
                  alignItems: "center", width: "100%", textAlign: "left",
                  padding: "12px 10px", gap: 4,
                  border: 0, borderTop: "1px solid " + T.line, background: "#fff",
                  color: T.ink, cursor: "pointer", fontSize: 11.5 }}>
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 700 }}>
                  {person.employeeName}
                </span>
                <span style={{textAlign:"center"}}>{person.hot}</span>
                <span style={{textAlign:"center"}}>{person.conversation}</span>
                <span style={{textAlign:"center"}}>{person.negotiation}</span>
                <span style={{textAlign:"center"}}>{person.won}</span>
              </button>
            ))}
            {!report.employees?.length && <div style={{ padding: 14, fontSize: 12, color: T.inkSoft }}>
              No employees match these filters.
            </div>}
          </div>
          <div style={{ fontSize: 11, color: T.inkSoft, lineHeight: 1.6, marginTop: 11 }}>
            Counts reflect saved stage changes for existing deals, grouped by their current assigned employee.
            The person who performed each change is shown in the deal details. Past movements stay
            in this report even if the deal progresses later.
          </div>
        </>
      )}
    </div>
  );
}
