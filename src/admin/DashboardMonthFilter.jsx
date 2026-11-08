import React, { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";

export function currentIstMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit"
  }).formatToParts(new Date());
  const year = parts.find(part => part.type === "year")?.value;
  const month = parts.find(part => part.type === "month")?.value;
  return year + "-" + month;
}

export function previousIstMonth(month) {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 2, 1)).toISOString().slice(0, 7);
}

export function periodMonth(period, customMonth) {
  const current = currentIstMonth();
  if (period === "all") return null;
  if (period === "current") return current;
  if (period === "previous") return previousIstMonth(current);
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(customMonth) ? customMonth : null;
}

export default function DashboardMonthFilter({
  T, phone = false, employee, onEmployeeChange, salesmen,
  period, onPeriodChange, customMonth, onCustomMonthChange
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const month = periodMonth(period, customMonth);
  const active = period !== "all" || (phone && employee !== "all");

  useEffect(() => {
    if (!open) return undefined;
    const outside = event => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const escape = event => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        aria-label="Dashboard filters"
        aria-expanded={open}
        title={month ? "Dashboard filters · " + month : "Dashboard filters · All time"}
        onClick={() => setOpen(value => !value)}
        style={{
          width: 34, height: 34, display: "grid", placeItems: "center",
          position: "relative", cursor: "pointer",
          border: "1px solid " + (active ? T.route : T.line),
          borderRadius: 9, background: "#fff", color: active ? T.route : T.ink,
        }}
      >
        <SlidersHorizontal size={17} />
        {active && <span aria-hidden="true" style={{
          position: "absolute", right: 4, top: 4, width: 5, height: 5,
          borderRadius: "50%", background: T.route,
        }} />}
      </button>
      {open && (
        <section aria-label="Dashboard filter options" style={{
          position: "absolute", top: 41, right: 0, zIndex: 140,
          width: "min(292px, calc(100vw - 32px))", boxSizing: "border-box",
          border: "1px solid " + T.line, borderRadius: 12,
          background: "#fff", padding: 14,
          boxShadow: "0 12px 32px rgba(22, 37, 48, .14)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <strong style={{ fontSize: 13, color: T.ink }}>Dashboard filters</strong>
            <button type="button" aria-label="Close dashboard filters" onClick={() => setOpen(false)}
              style={{ display: "grid", placeItems: "center", width: 25, height: 25, border: 0, borderRadius: 6, background: "transparent", color: T.inkSoft, cursor: "pointer" }}>
              <X size={15} />
            </button>
          </div>
          {phone && (
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.inkSoft, marginBottom: 12 }}>
              Employee
              <select aria-label="Dashboard employee" value={employee} onChange={event => onEmployeeChange(event.target.value)}
                style={{ display: "block", width: "100%", marginTop: 5, padding: "8px 10px", border: "1px solid " + T.line, borderRadius: 8, color: T.ink, background: "#fff", fontSize: 12 }}>
                <option value="all">All Team</option>
                {salesmen.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
            </label>
          )}
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.inkSoft }}>
            Time period
            <select aria-label="Dashboard month period" value={period} onChange={event => onPeriodChange(event.target.value)}
              style={{ display: "block", width: "100%", marginTop: 5, padding: "8px 10px", border: "1px solid " + T.line, borderRadius: 8, color: T.ink, background: "#fff", fontSize: 12 }}>
              <option value="all">All time</option>
              <option value="current">This month</option>
              <option value="previous">Last month</option>
              <option value="custom">Select month &amp; year</option>
            </select>
          </label>
          {period === "custom" && (
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.inkSoft, marginTop: 12 }}>
              Month &amp; year
              <input type="month" aria-label="Dashboard choose month" min="2020-01" max={currentIstMonth()} value={customMonth}
                onChange={event => onCustomMonthChange(event.target.value)}
                style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 5, padding: "8px 10px", border: "1px solid " + T.line, borderRadius: 8, color: T.ink, background: "#fff", fontSize: 12 }} />
            </label>
          )}
          <div style={{ marginTop: 12, fontSize: 10.5, lineHeight: 1.6, color: T.inkSoft }}>
            Filters Hot Leads, Conversation, Negotiation, Total Leads and Won only. Other cards stay live.
          </div>
        </section>
      )}
    </div>
  );
}
