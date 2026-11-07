import React, { useCallback, useEffect, useRef, useState } from "react";
import { BriefcaseBusiness, Plus, Search, X, Check, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "../api.js";

const formatMonth = (date) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit",
  }).formatToParts(date);
  return parts.find(p => p.type === "year").value + "-" + parts.find(p => p.type === "month").value;
};
const currentMonth = () => formatMonth(new Date());
function monthOptions(now = new Date()) {
  const [year, month] = formatMonth(now).split("-").map(Number);
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - index - 1, 1));
    return {
      value: date.toISOString().slice(0, 7),
      label: new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" }).format(date),
    };
  });
}
const friendlyStage = value => String(value || "Unknown").replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
const shortDate = value => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" }).format(date)
    : "—";
};
const textButton = (T, active = false) => ({
  border: "1px solid " + (active ? T.route : T.line),
  background: active ? T.route : "#fff",
  color: active ? "#fff" : T.inkSoft,
  borderRadius: 8, padding: "6px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer",
});
const inputStyle = T => ({
  width: "100%", boxSizing: "border-box", border: "1px solid " + T.line,
  background: "#fff", borderRadius: 9, padding: "9px 10px", fontSize: 12, color: T.ink,
});

export default function SalesmanMonthlyFocus({ T, fmtMoney, employeeId, active, online, onOpenLead }) {
  const options = monthOptions();
  const [month, setMonth] = useState(currentMonth);
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [busy, setBusy] = useState("");
  const [tab, setTab] = useState("Working");
  const [showAll, setShowAll] = useState(false);
  const [expandedDeal, setExpandedDeal] = useState(null);
  const requestSeq = useRef(0);
  const canEdit = month === currentMonth();

  const refresh = useCallback(async () => {
    const requestId = ++requestSeq.current;
    setLoading(true);
    setError("");
    try {
      const response = await api.salesmanMonthlyFocus(month, employeeId);
      if (requestSeq.current === requestId) setItems(response.items || []);
    } catch (err) {
      if (requestSeq.current === requestId) {
        setItems(null);
        setError(err.message || "Couldn't load this month's deals.");
      }
    } finally {
      if (requestSeq.current === requestId) setLoading(false);
    }
  }, [month, employeeId]);

  useEffect(() => {
    if (!active) return;
    if (!online) {
      requestSeq.current += 1;
      setLoading(false);
      setItems(null);
      setError("Connect to the internet to view your monthly deals.");
      return;
    }
    refresh();
    return () => { requestSeq.current += 1; };
  }, [active, online, refresh]);

  useEffect(() => {
    if (!active || !online) return undefined;
    window.addEventListener("engage:monthly-focus-changed", refresh);
    return () => window.removeEventListener("engage:monthly-focus-changed", refresh);
  }, [active, online, refresh]);

  useEffect(() => {
    if (!active || !adding || !online || !canEdit) return;
    let cancelled = false;
    const timeout = setTimeout(async () => {
      setSearchLoading(true);
      setSearchError("");
      try {
        const response = await api.salesmanMonthlyFocusSearch(query.trim(), employeeId);
        if (!cancelled) setResults(response.leads || []);
      } catch (err) {
        if (!cancelled) {
          setResults([]);
          setSearchError(err.message || "Couldn't search your deals.");
        }
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 240);
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [active, adding, online, canEdit, query, employeeId]);

  const changeMonth = (value) => {
    setMonth(value);
    setAdding(false);
    setTab("Working");
    setShowAll(false);
    setExpandedDeal(null);
    setQuery("");
    setResults([]);
  };

  const mutate = async (name, leadId, completed) => {
    if (busy || !canEdit || !online) return;
    setBusy(name + ":" + leadId);
    setError("");
    try {
      if (name === "add") await api.salesmanMonthlyFocusAdd(month, leadId, employeeId);
      if (name === "complete") await api.salesmanMonthlyFocusComplete(month, leadId, completed, employeeId);
      if (name === "remove") await api.salesmanMonthlyFocusRemove(month, leadId, employeeId);
      if (name === "add") {
        setAdding(false);
        setQuery("");
        setResults([]);
        setTab("Working");
      }
      await refresh();
      if (name === "remove" || name === "complete") setExpandedDeal(null);
    } catch (err) {
      setError(err.message || "Monthly deal change wasn't saved. Try again.");
    } finally {
      setBusy("");
    }
  };

  const saved = items || [];
  const working = saved.filter(item => !item.completed_at);
  const done = saved.filter(item => !!item.completed_at);
  const filtered = tab === "Working" ? working : tab === "Completed" ? done : saved;
  const visible = showAll ? filtered : filtered.slice(0, 4);
  const candidates = results.filter(result => !saved.some(item => item.id === result.id));

  return (
    <section aria-label="My Deals This Month" style={{
      marginTop: 14, border: "1px solid " + T.line, borderRadius: 16,
      background: "#fff", boxShadow: "0 2px 8px rgba(20,45,46,.05)",
      padding: "13px 14px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          <span aria-hidden="true" style={{ width: 31, height: 31, display: "grid", placeItems: "center", borderRadius: 10, background: "#EDF7F4", color: T.route }}>
            <BriefcaseBusiness size={16} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.ink }}>My Deals This Month</div>
            <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 2 }}>My monthly working list</div>
          </div>
        </div>
        <select aria-label="Monthly deal focus month" value={month} onChange={event => changeMonth(event.target.value)}
          style={{ maxWidth: "100%", flex: "0 1 146px", minWidth: 122, fontSize: 11, color: T.ink, border: "1px solid " + T.line, borderRadius: 8, background: "#fff", padding: "7px 4px" }}>
          {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>

      {loading && <p role="status" style={{ fontSize: 12, color: T.inkSoft, margin: "12px 0" }}>Loading monthly deals…</p>}
      {error && <div role="alert" style={{ fontSize: 11.5, color: T.danger, background: T.dangerSoft, padding: "9px 10px", borderRadius: 8, marginTop: 10 }}>
        {error}{" "}<button type="button" onClick={refresh} disabled={!online} style={{ border: 0, background: "transparent", color: T.route, fontWeight: 800, cursor: "pointer" }}>Retry</button>
      </div>}
      {items !== null && !loading && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 7, marginTop: 12 }}>
            {[
              ["Selected", saved.length], ["Working", working.length], ["Completed", done.length],
            ].map(([name, value]) => (
              <div key={name} style={{ background: "#F6F8F8", borderRadius: 10, padding: "9px 8px" }}>
                <div style={{ fontSize: 10, color: T.inkSoft }}>{name}</div>
                <div style={{ fontSize: 19, fontWeight: 800, color: T.ink, marginTop: 3 }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 13, gap: 6 }}>
            <strong style={{ fontSize: 12, color: T.ink }}>Monthly deal list</strong>
            {canEdit && (
              <button type="button" disabled={!online || !!busy} onClick={() => { setAdding(prev => !prev); setSearchError(""); }}
                style={{ display: "inline-flex", alignItems: "center", gap: 4, background: T.route, color: "#fff", border: 0, borderRadius: 8, padding: "7px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                {adding ? <X size={12} /> : <Plus size={12} />}{adding ? "Close" : "Add to Month"}
              </button>
            )}
          </div>
          {!canEdit && <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 6 }}>Past months are saved for review and cannot be edited.</div>}

          {adding && canEdit && (
            <div style={{ padding: 10, marginTop: 10, borderRadius: 10, border: "1px solid " + T.line }}>
              <div style={{ position: "relative" }}>
                <Search size={14} aria-hidden="true" style={{ position: "absolute", top: 10, left: 10, color: T.inkSoft }} />
                <input aria-label="Search my existing deals" placeholder="Search your existing deals…" value={query}
                  onChange={event => setQuery(event.target.value)} style={{ ...inputStyle(T), paddingLeft: 30 }} />
              </div>
              {searchLoading && <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 8 }}>Searching…</div>}
              {searchError && <div role="alert" style={{ fontSize: 11, color: T.danger, marginTop: 8 }}>{searchError}</div>}
              {!searchLoading && !searchError && (
                <div style={{ maxHeight: 225, overflowY: "auto", marginTop: 6 }}>
                  {candidates.map(result => (
                    <div key={result.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 1px", borderBottom: "1px solid " + T.line }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis" }}>{result.business_name}</div>
                        <div style={{ fontSize: 10, color: T.inkSoft }}>{friendlyStage(result.status)}</div>
                      </div>
                      <button type="button" aria-label={"Add " + result.business_name + " to my month"} disabled={!!busy}
                        onClick={() => mutate("add", result.id)}
                        style={{ ...textButton(T), color: T.route, flexShrink: 0 }}>Add</button>
                    </div>
                  ))}
                  {!candidates.length && <div style={{ padding: 8, fontSize: 11, color: T.inkSoft }}>No more matching deals to add.</div>}
                </div>
              )}
            </div>
          )}

          <div role="group" aria-label="Monthly deal status" style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 11 }}>
            {["Working", "Completed", "All"].map(nextTab => (
              <button type="button" key={nextTab} aria-pressed={tab === nextTab}
                onClick={() => { setTab(nextTab); setShowAll(false); setExpandedDeal(null); }} style={textButton(T, tab === nextTab)}>{nextTab}</button>
            ))}
          </div>
          <div style={{ display: "grid", gap: 8, marginTop: 9 }}>
            {visible.map(item => (
              <div key={item.id} style={{ border: "1px solid " + T.line, borderRadius: 11, padding: "10px 11px", minWidth: 0, overflowWrap: "anywhere" }}>
                <button type="button" aria-label={"Options for " + item.business_name}
                  aria-expanded={expandedDeal === item.id} aria-controls={"monthly-actions-" + item.id}
                  onClick={() => setExpandedDeal(prev => prev === item.id ? null : item.id)}
                  style={{ border: 0, width: "100%", display: "block", padding: 0, background: "transparent", cursor: "pointer", textAlign: "left", color: T.ink, minWidth: 0 }}>
                  <span style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8, minWidth: 0 }}>
                    <span style={{ color: T.route, fontSize: 12.5, fontWeight: 800, minWidth: 0, overflowWrap: "anywhere" }}>
                      {item.business_name}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0, gap: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: item.status === "won" ? T.verified : item.status === "lost" ? T.danger : T.inkSoft, background: "#F1F5F4", padding: "4px 7px", borderRadius: 15 }}>
                        {friendlyStage(item.status)}
                      </span>
                      {expandedDeal === item.id ? <ChevronUp size={13} color={T.inkSoft} /> : <ChevronDown size={13} color={T.inkSoft} />}
                    </span>
                  </span>
                  <span style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8, marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: T.inkSoft, minWidth: 0 }}>Value: <strong style={{ color: T.ink }}>{item.deal_value == null ? "—" : fmtMoney(Number(item.deal_value))}</strong></span>
                    <span style={{ fontSize: 11, color: T.inkSoft, minWidth: 0 }}>Follow-up: <strong style={{ color: T.ink }}>{shortDate(item.next_follow_up_date)}</strong></span>
                  </span>
                  <span style={{ display: "block", fontSize: 10, color: T.inkSoft, marginTop: 5 }}>
                    Last updated {shortDate(item.updated_at || item.created_at)}
                    <span style={{ marginLeft: 5 }}>· Tap for actions</span>
                  </span>
                </button>
                {expandedDeal === item.id && (
                  <div id={"monthly-actions-" + item.id} style={{
                    display: "flex", flexWrap: "wrap", alignItems: "center", gap: 7,
                    marginTop: 10, paddingTop: 10, borderTop: "1px solid " + T.line,
                  }}>
                    <button type="button" onClick={() => onOpenLead?.(item.id)}
                      aria-label={"View " + item.business_name + " deal"}
                      style={{ ...textButton(T), display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "1 1 92px", minHeight: 34, color: T.route }}>
                      View deal
                    </button>
                    {canEdit && (
                      <>
                        <button type="button" disabled={!!busy || !online}
                          aria-label={(item.completed_at ? "Reopen " : "Mark done ") + item.business_name}
                          onClick={() => mutate("complete", item.id, !item.completed_at)}
                          style={{ ...textButton(T), display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "1 1 100px", minHeight: 34, gap: 5, color: T.route }}>
                          {item.completed_at ? <RotateCcw size={12} /> : <Check size={12} />}
                          {item.completed_at ? "Reopen" : "Mark done"}
                        </button>
                        <button type="button" disabled={!!busy || !online}
                          aria-label={"Remove " + item.business_name + " from month"}
                          onClick={() => mutate("remove", item.id)}
                          style={{ ...textButton(T), display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "1 1 82px", minHeight: 34, color: T.danger }}>
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
            {!visible.length && <div style={{ fontSize: 11.5, color: T.inkSoft, padding: "12px 6px" }}>
              {saved.length === 0 ? "No deals selected yet. Add your current month's working deals." : "No deals in this view."}
            </div>}
            {filtered.length > 4 && <button type="button" onClick={() => setShowAll(prev => !prev)}
              style={{ ...textButton(T), display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
              {showAll ? <ChevronUp size={13} /> : <ChevronDown size={13} />}{showAll ? "Show less" : "View all " + filtered.length + " deals"}
            </button>}
          </div>
          <div style={{ marginTop: 9, fontSize: 10, color: T.inkSoft }}>Mark done only completes your monthly focus; it does not change the deal stage.</div>
        </>
      )}
    </section>
  );
}

export const _monthlyFocusTest = { formatMonth, monthOptions, friendlyStage, shortDate };
