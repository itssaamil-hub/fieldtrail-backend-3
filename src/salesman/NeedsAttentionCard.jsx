import React, { useEffect, useState } from "react";
import { AlertCircle, ChevronDown, ChevronUp, RefreshCw, Sparkles } from "lucide-react";
import { api } from "../api.js";

const statusLabel = (value) => String(value || "Lead").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function NeedsAttentionCard({ online, onOpenLead }) {
  const [open, setOpen] = useState(false);
  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

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
  const priorityLeads = briefing?.priorityLeads || [];
  const focus = briefing?.focus || briefing?.recommendation || "Review the most urgent follow-ups first.";
  const attentionCount = overdue + today + priorityLeads.length;

  return (
    <section style={{
      marginTop: 14,
      border: "1px solid #E2EBE8",
      borderRadius: 18,
      background: "linear-gradient(180deg,#FFFFFF 0%,#FBFDFC 100%)",
      boxShadow: "0 10px 28px rgba(23,57,58,.07)",
      overflow: "hidden",
    }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        style={{
          width: "100%",
          border: 0,
          background: "transparent",
          padding: "15px 16px 13px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ width: 34, height: 34, borderRadius: 11, display: "grid", placeItems: "center", background: "#EDF7F4", color: "#145C5D", flex: "0 0 auto" }}>
            <Sparkles size={17} strokeWidth={2.2} />
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <strong style={{ fontSize: 14.5, color: "#183738", letterSpacing: "-.01em" }}>Needs Attention</strong>
              {!loading && !error && attentionCount > 0 && <span style={{ minWidth: 22, height: 22, padding: "0 7px", borderRadius: 999, display: "inline-grid", placeItems: "center", background: "#FFF1E6", color: "#C56824", fontSize: 11.5, fontWeight: 800 }}>{attentionCount}</span>}
            </span>
            {loading && <span style={{ display: "block", marginTop: 3, fontSize: 11.5, color: "#7B8788" }}>Loading priorities…</span>}
            {error && <span style={{ display: "block", marginTop: 3, fontSize: 11.5, color: "#B64A3A" }}>Priorities unavailable</span>}
          </span>
        </span>
        <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 10, display: "grid", placeItems: "center", color: "#315657", background: "#F1F6F4", flex: "0 0 auto" }}>
          {open ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
        </span>
      </button>

      {!loading && !error && briefing && <div style={{ padding: "0 16px 15px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8 }}>
          {[
            [overdue, "Overdue", "#C45E2A", "#FFF4ED"],
            [today, "Today", "#145C5D", "#EDF7F4"],
            [upcoming, "Upcoming", "#51606A", "#F3F5F6"],
          ].map(([value, label, color, bg]) => <div key={label} style={{ borderRadius: 12, padding: "9px 8px", background: bg, textAlign: "center" }}>
            <div style={{ fontSize: 16, lineHeight: 1.1, fontWeight: 800, color }}>{value}</div>
            <div style={{ marginTop: 4, fontSize: 10.5, fontWeight: 700, color: "#667476" }}>{label}</div>
          </div>)}
        </div>

        <div style={{ marginTop: 11, padding: "10px 12px", borderRadius: 12, background: "#F7FAF9", border: "1px solid #E8EFEC" }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".08em", color: "#668080", textTransform: "uppercase" }}>Focus</div>
          <div style={{ marginTop: 4, fontSize: 12.5, lineHeight: 1.45, color: "#2D4647", fontWeight: 600 }}>{focus}</div>
        </div>
      </div>}

      {open && <div style={{ borderTop: "1px solid #E8EFEC", padding: "13px 16px 15px", background: "#FCFEFD" }}>
        {error && <div role="alert" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 11px", borderRadius: 12, background: "#FFF4F1", color: "#9E4034", fontSize: 12 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 7 }}><AlertCircle size={15} />{error}</span>
          <button type="button" onClick={() => setRetry((value) => value + 1)} style={{ border: 0, background: "transparent", color: "#145C5D", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><RefreshCw size={13} />Retry</button>
        </div>}
        {loading && <div role="status" style={{ fontSize: 12.5, color: "#728081" }}>Loading priorities…</div>}
        {!loading && !error && briefing && <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 9 }}>
            <strong style={{ fontSize: 12.5, color: "#244344" }}>Priority leads</strong>
            <span style={{ fontSize: 10.5, color: "#7B898A" }}>{priorityLeads.length ? `${priorityLeads.length} to review` : "All clear"}</span>
          </div>

          {priorityLeads.length ? <div style={{ display: "grid", gap: 8 }}>
            {priorityLeads.slice(0, 5).map((lead) => <button key={lead.id} type="button" onClick={() => onOpenLead?.(lead.id)} style={{ width: "100%", border: "1px solid #E5ECE9", borderRadius: 13, background: "#fff", padding: "11px 12px", textAlign: "left", cursor: "pointer", boxShadow: "0 4px 12px rgba(28,62,63,.04)" }}>
              <span style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: 12.8, color: "#203A3B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lead.business_name}</strong>
                  <span style={{ display: "block", marginTop: 4, fontSize: 10.8, color: "#768486", lineHeight: 1.35 }}>{lead.reasons?.length ? lead.reasons.join(" · ") : statusLabel(lead.status)}</span>
                </span>
                <span style={{ flex: "0 0 auto", fontSize: 11, fontWeight: 800, color: "#145C5D", paddingTop: 1 }}>View lead →</span>
              </span>
            </button>)}
            {priorityLeads.length > 5 && <div style={{ textAlign: "center", fontSize: 10.8, color: "#7C898B", paddingTop: 2 }}>+{priorityLeads.length - 5} more priority leads</div>}
          </div> : <div style={{ padding: "13px 12px", borderRadius: 12, background: "#F4FAF7", color: "#2E665B", fontSize: 12, fontWeight: 600 }}>Nothing urgent needs attention right now.</div>}

          <button type="button" onClick={() => setOpen(false)} style={{ width: "100%", marginTop: 11, border: 0, background: "transparent", color: "#5D7475", fontSize: 11.5, fontWeight: 750, cursor: "pointer", padding: "4px 0" }}>Show less ↑</button>
        </>}
      </div>}
    </section>
  );
}
