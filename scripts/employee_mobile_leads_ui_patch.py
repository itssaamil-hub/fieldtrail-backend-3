from pathlib import Path

app = Path('src/App.jsx')
text = app.read_text()

replacements = []
replacements.append((
    '<MyLeadsModal embedded leads={leads} onSelectLead={setViewingLead} allowDateFilter />',
    '<MyLeadsModal embedded leads={leads} onSelectLead={setViewingLead} allowDateFilter employeeMobile />'
))
replacements.append((
    'function MyLeadsModal({ leads, onClose, onSelectLead, title = "My Leads", allowDateFilter = false, embedded = false }) {',
    'function MyLeadsModal({ leads, onClose, onSelectLead, title = "My Leads", allowDateFilter = false, embedded = false, employeeMobile = false }) {'
))

old_states = '''  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [revenuePeriod, setRevenuePeriod] = useState("all"); // "all" | "month" — only shown for the Won Leads modal
  const isWonModal = title === "Won Leads";

  const shown = leads.filter(
    (l) =>
      (!filterDate || l.createdAt.toISOString().slice(0, 10) === filterDate) &&
      (filterStatus === "all" || l.status === filterStatus) &&
      (!isWonModal || revenuePeriod === "all" || isThisMonth(l.createdAt)) &&
      (!searchQuery.trim() || [l.business, l.owner, l.phone, l.subLocation].some((f) => f && f.toLowerCase().includes(searchQuery.trim().toLowerCase())))
  );'''
new_states = '''  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [revenuePeriod, setRevenuePeriod] = useState("all"); // "all" | "month" — only shown for the Won Leads modal
  const [employeeDatePreset, setEmployeeDatePreset] = useState("all");
  const [employeeDateFrom, setEmployeeDateFrom] = useState("");
  const [employeeDateTo, setEmployeeDateTo] = useState("");
  const [employeeSort, setEmployeeSort] = useState("latest_activity");
  const isWonModal = title === "Won Leads";

  const localDayStart = (value) => {
    if (!value) return null;
    const date = value instanceof Date ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  };
  const leadActivityDate = (lead) => lead.updatedAt || lead.createdAt;
  const employeeDateMatches = (lead) => {
    if (!employeeMobile || employeeDatePreset === "all") return true;
    const activity = localDayStart(leadActivityDate(lead));
    if (!activity) return false;
    const today = localDayStart(new Date());
    const daysAgo = Math.floor((today - activity) / 86400000);
    if (employeeDatePreset === "today") return daysAgo === 0;
    if (employeeDatePreset === "yesterday") return daysAgo === 1;
    if (employeeDatePreset === "last7") return daysAgo >= 0 && daysAgo <= 6;
    if (employeeDatePreset === "last30") return daysAgo >= 0 && daysAgo <= 29;
    if (employeeDatePreset === "month") return activity.getFullYear() === today.getFullYear() && activity.getMonth() === today.getMonth();
    if (employeeDatePreset === "custom") {
      const from = employeeDateFrom ? localDayStart(`${employeeDateFrom}T00:00:00`) : null;
      const to = employeeDateTo ? localDayStart(`${employeeDateTo}T00:00:00`) : null;
      return (!from || activity >= from) && (!to || activity <= to);
    }
    return true;
  };
  const employeeAttention = (lead) => {
    const today = localDayStart(new Date());
    const followUp = lead.nextFollowUpDate ? localDayStart(`${String(lead.nextFollowUpDate).slice(0, 10)}T00:00:00`) : null;
    const terminal = lead.status === "won" || lead.status === "lost";
    if (followUp && !terminal) {
      const diff = Math.round((followUp - today) / 86400000);
      if (diff < 0) return { label: "Overdue", tone: "overdue" };
      if (diff === 0) return { label: "Due today", tone: "due" };
      if (diff === 1) return { label: "Due tomorrow", tone: "due" };
    }
    const activity = localDayStart(leadActivityDate(lead));
    if (!activity) return { label: "", tone: "normal" };
    const age = Math.max(0, Math.floor((today - activity) / 86400000));
    if (age === 0) return { label: "Today", tone: "normal" };
    if (age === 1) return { label: "Yesterday", tone: "normal" };
    if (age < 7) return { label: `${age} days ago`, tone: "normal" };
    return { label: `${age} days old`, tone: "stale" };
  };

  const filtered = leads.filter(
    (l) =>
      (!filterDate || l.createdAt.toISOString().slice(0, 10) === filterDate) &&
      (filterStatus === "all" || l.status === filterStatus) &&
      (!isWonModal || revenuePeriod === "all" || isThisMonth(l.createdAt)) &&
      employeeDateMatches(l) &&
      (!searchQuery.trim() || [l.business, l.owner, l.phone, l.subLocation].some((f) => f && f.toLowerCase().includes(searchQuery.trim().toLowerCase())))
  );
  const shown = employeeMobile ? [...filtered].sort((a, b) => {
    const activityA = new Date(leadActivityDate(a) || 0).getTime();
    const activityB = new Date(leadActivityDate(b) || 0).getTime();
    if (employeeSort === "oldest_activity") return activityA - activityB;
    if (employeeSort === "newest_lead") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (employeeSort === "oldest_lead") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (employeeSort === "follow_up") {
      const follow = (lead) => lead.nextFollowUpDate ? new Date(`${String(lead.nextFollowUpDate).slice(0, 10)}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;
      return follow(a) - follow(b) || activityB - activityA;
    }
    return activityB - activityA;
  }) : filtered;'''
replacements.append((old_states, new_states))

old_filters = '''      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {!isWonModal && (
          <Select value={filterStatus} onChange={setFilterStatus} options={[["all", "All statuses"], ...STATUSES.map((s) => [s, STATUS_LABEL[s]])]} />
        )}
        {allowDateFilter && (
          <>
            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{ ...inputStyle, marginBottom: 0, flex: 1, minWidth: 130 }} />
            {filterDate && (
              <button onClick={() => setFilterDate("")} style={{ fontSize: 11.5, color: T.inkSoft, background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
                Clear date
              </button>
            )}
          </>
        )}
      </div>'''
new_filters = '''      {employeeMobile ? (
        <>
          <div className="employee-mobile-lead-filters">
            <select aria-label="Lead status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="all">Status</option>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <select aria-label="Lead date" value={employeeDatePreset} onChange={(e) => setEmployeeDatePreset(e.target.value)}>
              <option value="all">Date</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7">Last 7 days</option>
              <option value="last30">Last 30 days</option>
              <option value="month">This month</option>
              <option value="custom">Custom range</option>
            </select>
            <select aria-label="Lead sort" value={employeeSort} onChange={(e) => setEmployeeSort(e.target.value)}>
              <option value="latest_activity">Latest activity</option>
              <option value="oldest_activity">Oldest activity</option>
              <option value="newest_lead">Newest lead</option>
              <option value="oldest_lead">Oldest lead</option>
              <option value="follow_up">Follow-up due</option>
            </select>
          </div>
          {employeeDatePreset === "custom" && (
            <div className="employee-mobile-custom-date">
              <input aria-label="Date from" type="date" value={employeeDateFrom} onChange={(e) => setEmployeeDateFrom(e.target.value)} />
              <input aria-label="Date to" type="date" value={employeeDateTo} onChange={(e) => setEmployeeDateTo(e.target.value)} />
            </div>
          )}
        </>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {!isWonModal && (
            <Select value={filterStatus} onChange={setFilterStatus} options={[["all", "All statuses"], ...STATUSES.map((s) => [s, STATUS_LABEL[s]])]} />
          )}
          {allowDateFilter && (
            <>
              <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{ ...inputStyle, marginBottom: 0, flex: 1, minWidth: 130 }} />
              {filterDate && (
                <button onClick={() => setFilterDate("")} style={{ fontSize: 11.5, color: T.inkSoft, background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
                  Clear date
                </button>
              )}
            </>
          )}
        </div>
      )}'''
replacements.append((old_filters, new_filters))

old_meta = '                  <span>{STATUS_LABEL[l.status]} · {fmtTime(l.createdAt)}</span>'
new_meta = '''                  {employeeMobile ? (() => {
                    const attention = employeeAttention(l);
                    return <span className={`employee-mobile-lead-meta employee-mobile-lead-meta--${attention.tone}`}><span>{STATUS_LABEL[l.status]}</span>{attention.label && <><span aria-hidden="true"> · </span><strong>{attention.label}</strong></>}</span>;
                  })() : <span>{STATUS_LABEL[l.status]} · {fmtTime(l.createdAt)}</span>}'''
replacements.append((old_meta, new_meta))

for old, new in replacements:
    if old not in text:
        raise SystemExit(f'Expected App.jsx block not found: {old[:80]}')
    text = text.replace(old, new, 1)
app.write_text(text)

api = Path('src/api.js')
api_text = api.read_text()
old_api = '    createdAt: new Date(row.created_at),\n    notes: row.notes || "",'
new_api = '    createdAt: new Date(row.created_at),\n    updatedAt: new Date(row.updated_at || row.created_at),\n    notes: row.notes || "",'
if old_api not in api_text:
    raise SystemExit('mapLeadRow createdAt block not found')
api.write_text(api_text.replace(old_api, new_api, 1))

css = Path('src/index.css')
css_text = css.read_text()
marker = '/* Employee phone Leads: compact filters and actionable age/overdue metadata. */'
if marker not in css_text:
    css_text += '''\n\n/* Employee phone Leads: compact filters and actionable age/overdue metadata. */
.employee-mobile-lead-filters {
  display: grid;
  grid-template-columns: .82fr .82fr 1.36fr;
  gap: 7px;
  margin-bottom: 12px;
}
.employee-mobile-lead-filters select,
.employee-mobile-custom-date input {
  width: 100%;
  min-width: 0;
  height: 38px;
  box-sizing: border-box;
  border: 1px solid #E7E9EE;
  border-radius: 10px;
  background: #fff;
  color: #1A1D23;
  padding: 0 9px;
  font: inherit;
  font-size: 11.5px;
  font-weight: 600;
}
.employee-mobile-custom-date {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
  margin: -4px 0 12px;
}
.employee-mobile-lead-meta strong { font-weight: 700; }
.employee-mobile-lead-meta--overdue strong { color: #C0392B; }
.employee-mobile-lead-meta--due strong { color: #B8791F; }
.employee-mobile-lead-meta--stale strong { color: #8A6430; }
@media (max-width: 380px) {
  .employee-mobile-lead-filters { grid-template-columns: 1fr 1fr; }
  .employee-mobile-lead-filters select:last-child { grid-column: 1 / -1; }
}
'''
    css.write_text(css_text)
