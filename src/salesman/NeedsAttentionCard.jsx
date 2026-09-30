import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import "../notifications.css";

export default function NeedsAttentionCard({ online, onOpenLead }) {
  const [open, setOpen] = useState(false);
  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [followUpFilter, setFollowUpFilter] = useState("today");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    if (!online) {
      setLoading(false);
      setError("Connect to load your latest priorities.");
      return () => { cancelled = true; };
    }
    api.salesBriefing().then((res) => {
      if (cancelled) return;
      if (!res?.briefing) throw new Error("The server returned an empty briefing.");
      setBriefing(res.briefing);
    }).catch((err) => {
      if (!cancelled) setError(err.message || "Could not load your priorities.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [online, retry]);

  const followUps = briefing?.followUps || {};
  const today = followUps.today?.length || 0;
  const overdue = followUps.overdue?.length || 0;
  const upcoming = followUps.upcoming?.length || 0;
  const priorityCount = briefing?.priorityLeads?.length || 0;

  const tabs = [
    ["all", "All", followUps.all?.length || 0],
    ["today", "Today", today],
    ["overdue", "Overdue", overdue],
    ["upcoming", "Upcoming", upcoming],
  ];
  const items = followUps[followUpFilter] || [];

  return (
    <section style={{ marginTop: 14, border: "1px solid #E7E9EE", borderRadius: 14, background: "#fff", overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        style={{ width: "100%", border: 0, background: "#fff", padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, cursor: "pointer", textAlign: "left" }}
      >
        <span>
          <strong style={{ display: "block", fontSize: 14, color: "#1A1D23" }}>Needs Attention</strong>
          {!loading && !error && briefing && <span style={{ display: "block", marginTop: 3, fontSize: 11.5, color: "#6B7280" }}>{overdue} overdue · {today} today · {upcoming} upcoming</span>}
          {loading && <span style={{ display: "block", marginTop: 3, fontSize: 11.5, color: "#6B7280" }}>Loading priorities…</span>}
          {error && <span style={{ display: "block", marginTop: 3, fontSize: 11.5, color: "#C0392B" }}>Priorities unavailable</span>}
        </span>
        <span aria-hidden="true" style={{ color: "#145C5D", fontSize: 18, lineHeight: 1 }}>{open ? "⌃" : "⌄"}</span>
      </button>

      {open && <div style={{ borderTop: "1px solid #E7E9EE", padding: "12px 14px 14px" }}>
        {error && <div className="ft-notifications-error" role="alert"><p>{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button></div>}
        {loading && <p role="status" style={{ margin: 0, fontSize: 12.5, color: "#6B7280" }}>Preparing your briefing…</p>}
        {!loading && briefing && <article className="ft-briefing-story" style={{ margin: 0 }}>
          {(briefing.paragraphs || [briefing.summary]).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          {briefing.followUps && <div className="ft-followup-brief">
            <div className="ft-followup-tabs" role="tablist" aria-label="Follow-up filter">{tabs.map(([key, label, count]) =>
              <button key={key} type="button" role="tab" aria-selected={followUpFilter === key} className={followUpFilter === key ? `is-active is-${key}` : ""} onClick={() => setFollowUpFilter(key)}><strong>{count}</strong><span>{label}</span></button>
            )}</div>
            <div className="ft-followup-list">
              {items.length ? items.slice(0, 8).map((lead) => <button type="button" className="ft-followup-row" key={`${followUpFilter}-${lead.id}`} onClick={() => onOpenLead?.(lead.id)}>
                <span><strong>{lead.business_name}</strong><small>{lead.status?.replaceAll("_", " ") || "Lead"} · {lead.next_follow_up_date}</small></span><span aria-hidden="true">›</span>
              </button>) : <div className="ft-followup-empty">No {followUpFilter === "all" ? "scheduled" : followUpFilter} follow-ups.</div>}
              {items.length > 8 && <div className="ft-followup-more">+{items.length - 8} more</div>}
            </div>
          </div>}
          <div className="ft-briefing-focus"><strong>Your focus today</strong><p>{briefing.focus || briefing.recommendation}</p></div>
          {!!priorityCount && <>
            <div className="ft-briefing-action" style={{ cursor: "default" }}>{priorityCount} priority {priorityCount === 1 ? "lead" : "leads"}</div>
            <ol id="ft-dashboard-briefing-priorities">{briefing.priorityLeads.map((lead) => <li key={lead.id}><div><strong>{lead.business_name}</strong><div className="ft-notifications-date">{lead.reasons.join(" · ")}</div></div><button type="button" onClick={() => onOpenLead?.(lead.id)}>View lead</button></li>)}</ol>
          </>}
        </article>}
      </div>}
    </section>
  );
}
