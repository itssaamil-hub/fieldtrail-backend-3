import React, { useEffect, useState } from "react";
import { api } from "./api.js";
import { OnboardingDialog } from "./Onboarding.jsx";
import "./quotations.css";

const istToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const time = (v) => new Date(v).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const ICON = { day: "⏱", lead: "📍", visit: "🚶", quote: "📄", task: "✅", payment: "💰", onboarding: "🧾" };
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function headline(b) {
  const s = b.summary, name = b.employee.name.split(" ")[0];
  if (!b.sessions.length && !b.events.length) return `${name} has no recorded activity on this day.`;
  const parts = [];
  if (s.leadsAdded) parts.push(`added ${plural(s.leadsAdded, "lead")}`);
  if (s.statusChanges) parts.push(`moved ${plural(s.statusChanges, "lead")} through the pipeline${s.won ? ` (${s.won} won)` : ""}`);
  if (s.visits) parts.push(`made ${plural(s.visits, "visit")}`);
  if (s.quotes) parts.push(`worked on ${plural(s.quotes, "quotation")}`);
  if (s.tasksDone) parts.push(`completed ${plural(s.tasksDone, "task")}`);
  if (s.payments) parts.push(`recorded ${plural(s.payments, "payment")}`);
  const first = b.sessions[0], last = b.sessions[b.sessions.length - 1];
  const span = first ? `started at ${time(first.startedAt)}${last.endedAt ? ` and ended at ${time(last.endedAt)}` : " and is still on the day"}` : "did not start the day";
  return `${name} ${span}${parts.length ? `, ${parts.slice(0, -1).join(", ")}${parts.length > 1 ? " and " : ""}${parts[parts.length - 1]}` : ", with no other recorded activity"}.`;
}

export default function SalesmanBriefPopup({ salesman, onClose }) {
  const [date, setDate] = useState(istToday());
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!date) return;
    let live = true;
    setLoading(true); setError("");
    api.adminSalesmanBrief(salesman.id, date)
      .then((v) => { if (live) setData(v); })
      .catch((e) => { if (live) { setData(null); setError(e.message || "Couldn't load the brief."); } })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [salesman.id, date]);

  const s = data?.summary;
  return (
    <OnboardingDialog title={`Brief — ${salesman.name || "Employee"}`} onClose={onClose} busy={false}>
      <div className="ft-q">
        <label className="ft-ob-field">Date · IST
          <input type="date" value={date} max={istToday()} onChange={(e) => setDate(e.target.value)} />
        </label>
        {error && <p role="alert">{error}</p>}
        {loading && <p>Loading…</p>}
        {!loading && data && <>
          <p className="ft-ob-muted" style={{ fontSize: 13.5, lineHeight: 1.5 }}>{headline(data)}</p>
          <div className="ft-q-box"><div className="ft-q-grid">
            {[["leadsAdded", "Leads added"], ["visits", "Visits"], ["statusChanges", "Stage changes"], ["quotes", "Quotation actions"], ["tasksDone", "Tasks done"], ["payments", "Payments"]].map(([k, l]) => <div key={k}><strong>{s[k]}</strong> {l}</div>)}
            {s.distanceKm > 0 && <div><strong>{s.distanceKm}</strong> km travelled</div>}
          </div></div>
          <div className="ft-q-box"><h3>Timeline</h3>
            {data.events.length === 0 && <p className="ft-ob-muted">Nothing recorded.</p>}
            {data.events.map((e, i) => (
              <div key={i} style={{ display: "flex", gap: 8, padding: "5px 0", fontSize: 13 }}>
                <span aria-hidden>{ICON[e.type] || "•"}</span>
                <span style={{ minWidth: 62, color: "#6b7785" }}>{time(e.at)}</span>
                <span style={{ overflowWrap: "anywhere" }}>{e.text}</span>
              </div>
            ))}
          </div>
          {data.closing.map((c) => (
            <div className="ft-q-box" key={c.session}><h3>Day Closing{data.closing.length > 1 ? ` · session ${c.session}` : ""} · {c.status === "submitted" ? "Submitted" : c.status === "skipped" ? "Skipped" : "Not required"}</h3>
              {[["outcomes", "Outcomes"], ["blockers", "Blockers"], ["priorities", "Tomorrow’s priorities"], ["skipReason", "Skip reason"]].map(([k, l]) => c[k] ? <div key={k}><strong>{l}</strong><p className="ft-q-text">{c[k]}</p></div> : null)}
            </div>
          ))}
        </>}
      </div>
    </OnboardingDialog>
  );
}
