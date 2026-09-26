from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
app_path = ROOT / 'src' / 'App.jsx'
main_path = ROOT / 'src' / 'main.jsx'
quotes_path = ROOT / 'src' / 'Quotations.jsx'


def must_replace(text, old, new, label):
    if old not in text:
        raise SystemExit(f'Missing expected block: {label}')
    return text.replace(old, new, 1)

app = app_path.read_text()

# Native daily comparisons for cards whose value is explicitly TODAY.
anchor = '// True if a date falls between today and `days` days from now (inclusive) —'
helper = '''const dailyComparisonFor = (items, period, predicate = () => true) => {
  const now = new Date();
  const currentStart = new Date(now); currentStart.setHours(0, 0, 0, 0);
  const previousNow = new Date(now);
  if (period === "monthly") previousNow.setMonth(previousNow.getMonth() - 1);
  else previousNow.setDate(previousNow.getDate() - 7);
  const previousStart = new Date(previousNow); previousStart.setHours(0, 0, 0, 0);
  const count = (start, end) => items.filter((x) => x.createdAt >= start && x.createdAt <= end && predicate(x)).length;
  const current = count(currentStart, now);
  const previous = count(previousStart, previousNow);
  if (previous === 0) return { current, previous, pct: current === 0 ? 0 : null };
  return { current, previous, pct: Math.round(((current - previous) / previous) * 100) };
};
'''
if 'const dailyComparisonFor =' not in app:
    app = must_replace(app, anchor, helper + anchor, 'daily comparison helper anchor')

old_compare = '''  const dashboardComparison = dashboardDisplay.showComparisons !== false ? comparisonFor(dashboardLeads, dashboardDisplay.comparisonPeriod || "weekly") : null;
  const hotComparison = dashboardDisplay.showComparisons !== false ? comparisonFor(dashboardLeads, dashboardDisplay.comparisonPeriod || "weekly", (l) => l.status === "hot") : null;
'''
new_compare = '''  const comparisonPeriod = dashboardDisplay.comparisonPeriod || "weekly";
  const comparisonsEnabled = dashboardDisplay.showComparisons !== false;
  const dashboardComparison = comparisonsEnabled ? comparisonFor(dashboardLeads, comparisonPeriod) : null;
  const conversationComparison = comparisonsEnabled ? comparisonFor(dashboardLeads, comparisonPeriod, (l) => l.status === "conversation") : null;
  const leadsTodayComparison = comparisonsEnabled ? dailyComparisonFor(dashboardLeads, comparisonPeriod) : null;
  const hotComparison = comparisonsEnabled ? dailyComparisonFor(dashboardLeads, comparisonPeriod, (l) => l.status === "hot") : null;
  const negotiationComparison = comparisonsEnabled ? comparisonFor(dashboardLeads, comparisonPeriod, (l) => l.status === "negotiation") : null;
  const wonComparison = comparisonsEnabled ? comparisonFor(dashboardLeads, comparisonPeriod, (l) => l.status === "won") : null;
'''
app = must_replace(app, old_compare, new_compare, 'dashboard comparison definitions')

cards = {
'''        <StatCard variant="dashboard" label="Conversation" value={conversationCount ?? "—"} icon={MessageSquare} color={T.route} onClick={async () => { try { setConversationError(""); const result=await api.adminLeads({status:"conversation"}); setStatLeadsModal({title:conversationCount>500?"Conversation Leads · Latest 500":"Conversation Leads",leads:(result.leads||[]).map(mapLeadRow)}); } catch(e) { setConversationError(e.message); } }} />''':
'''        <StatCard variant="dashboard" label="Conversation" value={conversationCount ?? "—"} comparison={conversationComparison} comparisonPeriod={comparisonPeriod} icon={MessageSquare} color={T.route} onClick={async () => { try { setConversationError(""); const result=await api.adminLeads({status:"conversation"}); setStatLeadsModal({title:conversationCount>500?"Conversation Leads · Latest 500":"Conversation Leads",leads:(result.leads||[]).map(mapLeadRow)}); } catch(e) { setConversationError(e.message); } }} />''',
'''        <StatCard variant="dashboard" label="Leads Today" value={todayLeads.length} icon={TargetIcon} color="#3B82F6" onClick={() => setStatLeadsModal({ title: "Leads Today", leads: todayLeads })} />''':
'''        <StatCard variant="dashboard" label="Leads Today" value={todayLeads.length} comparison={leadsTodayComparison} comparisonPeriod={comparisonPeriod} icon={TargetIcon} color="#3B82F6" onClick={() => setStatLeadsModal({ title: "Leads Today", leads: todayLeads })} />''',
'''        <StatCard variant="dashboard" label="In Negotiation" value={inNegotiation.length} icon={Handshake} color="#8B5CF6" onClick={() => setStatLeadsModal({ title: "In Negotiation", leads: inNegotiation })} />''':
'''        <StatCard variant="dashboard" label="In Negotiation" value={inNegotiation.length} comparison={negotiationComparison} comparisonPeriod={comparisonPeriod} icon={Handshake} color="#8B5CF6" onClick={() => setStatLeadsModal({ title: "In Negotiation", leads: inNegotiation })} />''',
'''        <StatCard variant="dashboard" label="Won" value={converted} icon={CheckCircle2} color={T.verified} onClick={() => setStatLeadsModal({ title: "Won Leads", leads: dashboardLeads.filter((l) => l.status === "won") })} />''':
'''        <StatCard variant="dashboard" label="Won" value={converted} comparison={wonComparison} comparisonPeriod={comparisonPeriod} icon={CheckCircle2} color={T.verified} onClick={() => setStatLeadsModal({ title: "Won Leads", leads: dashboardLeads.filter((l) => l.status === "won") })} />''',
}
for old, new in cards.items():
    app = must_replace(app, old, new, 'dashboard stat card')
app = app.replace('comparisonPeriod={dashboardDisplay.comparisonPeriod}', 'comparisonPeriod={comparisonPeriod}')

# Native pipeline reset: React owns all filter state.
old_clear = '''            {filterDate && (
              <button onClick={() => setFilterDate("")} style={{ fontSize: 11.5, color: T.inkSoft, background: "none", border: "none", cursor: "pointer", padding: "6px 4px" }}>
                Clear date
              </button>
            )}
'''
new_clear = old_clear + '''            {(filterSalesman !== "all" || filterStatus !== "all" || filterDate || searchQuery.trim()) && (
              <button
                type="button"
                onClick={() => { setFilterSalesman("all"); setFilterStatus("all"); setFilterDate(""); setSearchQuery(""); }}
                style={{ fontSize: 11.5, color: T.route, background: "#EAF5F0", border: `1px solid ${T.line}`, borderRadius: 8, cursor: "pointer", padding: "6px 9px", fontWeight: 750 }}
              >
                Reset filters
              </button>
            )}
'''
app = must_replace(app, old_clear, new_clear, 'pipeline reset filters')

# Replace DOM-mutated Employee panel with React-owned search/filter/pagination/today summary.
start = app.index('function SalesmenPanel(')
end = app.index('// Draws a salesman\'s GPS trail', start)
new_salesmen = r'''function SalesmenPanel({ salesmen, leads, onAddClick, onSettingsClick, onBriefClick, onDeleteClick, onViewRoute, onMessageClick, onOpenSalesmanLeads }) {
  const PAGE_SIZE = 8;
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [briefs, setBriefs] = useState({});

  useEffect(() => {
    let live = true;
    const token = getSession()?.token;
    const base = getApiBase();
    if (!token || !base || !salesmen.length) { setBriefs({}); return undefined; }
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    Promise.all(salesmen.map(async (person) => {
      try {
        const res = await fetch(`${base}/admin/salesmen/${encodeURIComponent(person.id)}/brief?date=${day}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        return [person.id, res.ok ? await res.json() : null];
      } catch { return [person.id, null]; }
    })).then((rows) => { if (live) setBriefs(Object.fromEntries(rows)); });
    return () => { live = false; };
  }, [salesmen]);

  const employeeStatus = (s) => {
    if (s.status === "online") return "online";
    const sessions = briefs[s.id]?.sessions || [];
    return sessions.length ? "offline" : "not-started";
  };
  const q = query.trim().toLowerCase();
  const filtered = salesmen.filter((s) => {
    const status = employeeStatus(s);
    const matchesStatus = statusFilter === "all" || status === statusFilter;
    const haystack = `${s.name || ""} ${s.employeeCode || ""} ${s.area || ""}`.toLowerCase();
    return matchesStatus && (!q || haystack.includes(q));
  });
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [query, statusFilter]);

  const briefLine = (s) => {
    const brief = briefs[s.id];
    if (!brief) return "Today · Activity unavailable";
    const session = brief.sessions?.[0];
    const started = session?.startedAt ? `Started ${new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(session.startedAt))}` : "Not started";
    const leadCount = Number(brief.glance?.leadsAdded || 0);
    const followups = Number(brief.followUpHealth?.dueToday || 0);
    const tasks = Number(brief.unfinished?.pendingTasks || 0);
    return `Today · ${started} · ${leadCount} lead${leadCount === 1 ? "" : "s"} · ${followups} follow-up${followups === 1 ? "" : "s"} · ${tasks} task${tasks === 1 ? "" : "s"}`;
  };

  return (
    <div className="ft-card engage-employee-panel-enhanced" style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}>Employees</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => onMessageClick("all")} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, border: `1px solid ${T.line}`, cursor: "pointer", background: "#fff", color: T.ink, fontWeight: 700, fontSize: 12 }}><MessageSquare size={13} /> Message all</button>
          <button onClick={onAddClick} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: T.route, color: "#fff", fontWeight: 700, fontSize: 12 }}><Plus size={13} /> Add Employee</button>
        </div>
      </div>

      <div className="engage-employee-controls" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div className="engage-employee-search-wrap" style={{ flex: "1 1 220px", position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.inkSoft }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} type="search" placeholder="Search employees" aria-label="Search employees" style={{ ...inputStyle, margin: 0, paddingLeft: 31, width: "100%", boxSizing: "border-box" }} />
        </div>
        <div className="engage-employee-filter" style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {[["all","All"],["online","Online"],["offline","Offline"],["not-started","Not started"]].map(([key,label]) => (
            <button key={key} type="button" onClick={() => setStatusFilter(key)} style={{ border: `1px solid ${statusFilter === key ? T.route : T.line}`, background: statusFilter === key ? "#EAF5F0" : "#fff", color: statusFilter === key ? T.route : T.inkSoft, borderRadius: 8, padding: "6px 9px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>{label}</button>
          ))}
        </div>
      </div>

      {salesmen.length === 0 && <div style={{ fontSize: 12.5, color: T.inkSoft }}>No salesmen yet — add your first one.</div>}
      {salesmen.length > 0 && filtered.length === 0 && <div style={{ fontSize: 12.5, color: T.inkSoft, padding: "14px 2px" }}>No employees match these filters.</div>}
      {visible.map((s) => {
        const status = employeeStatus(s);
        return <div key={s.id} className={`ft-row${status === "online" ? " engage-employee-online-card" : ""}`} data-employee-status={status} style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: 12, background: "#fff", opacity: s.isActive === false ? 0.55 : 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div onClick={() => onOpenSalesmanLeads(s)} style={{ fontWeight: 700, fontSize: 13.5, cursor: "pointer", color: T.route }}>{s.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button type="button" className="ft-lead-brief-pill" aria-label={`Brief for ${s.name}`} onClick={() => onBriefClick(s)}><Sparkles size={11} /> Brief</button>
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: s.isActive === false ? "#EEE" : status === "online" ? T.verifiedSoft : "#EEE", color: s.isActive === false ? "#888" : status === "online" ? T.verified : "#888" }}>{s.isActive === false ? "Deactivated" : status === "online" ? "Online" : status === "not-started" ? "Not started" : "Offline"}</span>
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 3 }}>{s.area}{s.employeeCode ? ` · ${s.employeeCode}` : ""}</div>
          <div className="engage-employee-today" style={{ fontSize: 11, color: T.inkSoft, marginTop: 7 }}>{briefLine(s)}</div>
          <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11, color: T.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Battery size={12} /> {s.battery != null ? `${Math.round(s.battery)}%` : "—"}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Gauge size={12} /> {s.speed.toFixed(1)} km/h</span>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Clock size={12} /> {fmtTime(s.lastUpdate)}</span>
          </div>
          <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 3 }}>{(s.distanceM / 1000).toFixed(1)} km travelled today</div>
          <MonthlyProgressBar salesmanId={s.id} target={s.monthlyTarget} leads={leads} />
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
            <button onClick={() => onViewRoute(s)} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: T.route, background: "none", border: "none", cursor: "pointer", padding: 0 }}><Route size={12} /> View route</button>
            <button onClick={() => onMessageClick(s)} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: T.route, background: "none", border: "none", cursor: "pointer", padding: 0 }}><MessageSquare size={12} /> Message</button>
            <button onClick={() => onSettingsClick(s)} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: T.inkSoft, background: "none", border: "none", cursor: "pointer", padding: 0 }}><Settings size={12} /> Settings</button>
          </div>
        </div>;
      })}

      {filtered.length > PAGE_SIZE && <div className="engage-employee-pagination" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, paddingTop: 4 }}>
        <span style={{ fontSize: 11.5, color: T.inkSoft }}>{(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" disabled={safePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
          <button type="button" disabled={safePage === pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>Next</button>
        </div>
      </div>}
    </div>
  );
}

'''
app = app[:start] + new_salesmen + app[end:]
app_path.write_text(app)

# Quotation settings enhancements become declarative React markup.
quotes = quotes_path.read_text()
quotes = must_replace(quotes, '<div className="ft-q">', '<div className="ft-q ft-q-settings-shell">', 'quotation settings root')
quotes = must_replace(quotes, '<form onSubmit={save}>', '<form className="ft-q-settings-form" onSubmit={save}>', 'quotation settings form')
replacements = {
    '<h3>Company & branding</h3>': '<h3 className="ft-q-settings-heading" data-section="1">Company & branding</h3><p className="ft-q-settings-description">Control the company identity, currency, quote numbering and support details shown on quotations.</p>',
    '<h3>Packages</h3>': '<h3 className="ft-q-settings-heading" data-section="2">Packages</h3><p className="ft-q-settings-description">Set the core packages your sales team can quote. Add clear features so customers understand what is included.</p>',
    '<h3>Optional add-ons</h3>': '<h3 className="ft-q-settings-heading" data-section="3">Optional add-ons</h3><p className="ft-q-settings-description">Manage optional extras that can be added to a quotation without changing the main package.</p>',
    '<h3>Discount & payment rules</h3>': '<h3 className="ft-q-settings-heading" data-section="4">Discount & payment rules</h3><p className="ft-q-settings-description">Define discount limits, validity, advance payment and tax defaults used by the sales team.</p>',
}
for old, new in replacements.items():
    quotes = must_replace(quotes, old, new, f'quotation heading {old}')
quotes_path.write_text(quotes)

# Remove global DOM enhancers now replaced by React.
main = main_path.read_text()
for line in [
    'import "./dashboardComparisons.js";\n',
    'import "./pipelineEnhance.js";\n',
    'import "./employeePanelEnhance.js";\n',
    'import "./quotationSettingsEnhance.js";\n',
]:
    main = main.replace(line, '')
main_path.write_text(main)

print('Strong frontend batch 1 applied.')
