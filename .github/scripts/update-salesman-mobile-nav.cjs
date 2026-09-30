const fs = require('fs');

const replaceOnce = (text, oldValue, newValue, label) => {
  if (text.includes(newValue)) return text;
  if (!text.includes(oldValue)) throw new Error(`${label} anchor not found`);
  return text.replace(oldValue, newValue);
};

// 1) Bottom nav: Dashboard · Contacts · Tasks · Messages · More
const navPath = 'src/AdminMobileNav.jsx';
let nav = fs.readFileSync(navPath, 'utf8');
nav = replaceOnce(
  nav,
  'export const salesmanTabs = [["dashboard", "Dashboard", Gauge], ["add-contact", "Add Contact", Contact2], ["tasks", "Tasks", ClipboardList], ["messages", "Messages", MessageSquare], ["more", "More", Menu]];',
  'export const salesmanTabs = [["dashboard", "Dashboard", Gauge], ["contacts", "Contacts", Contact2], ["tasks", "Tasks", ClipboardList], ["messages", "Messages", MessageSquare], ["more", "More", Menu]];',
  'salesmanTabs'
);
fs.writeFileSync(navPath, nav);

// 2) Employee view: Contacts reuses admin MobileContacts, quick actions renamed,
//    My Deal opens the existing embedded My Leads view.
const viewPath = 'src/salesman/SalesmanView.jsx';
let view = fs.readFileSync(viewPath, 'utf8');
view = replaceOnce(
  view,
  'import { AlertTriangle, Play, Square, CheckCircle2, Loader2, WifiOff, Target as TargetIcon, Flame, MessageSquare, Handshake, CalendarClock, Plus, List } from "lucide-react";',
  'import { AlertTriangle, Play, Square, CheckCircle2, Loader2, WifiOff, Target as TargetIcon, Flame, MessageSquare, Handshake, CalendarClock, Plus, List, Search } from "lucide-react";',
  'SalesmanView lucide import'
);
if (!view.includes('import MobileContacts from "../MobileContacts.jsx";')) {
  view = view.replace('import { showSaveFeedback } from "../saveFeedback.js";','import { showSaveFeedback } from "../saveFeedback.js";\nimport MobileContacts from "../MobileContacts.jsx";');
}
view = replaceOnce(
  view,
  '  const { T, fmtMoney, isToday, isThisMonth, isWithinDays, isUpcomingRenewalMonth, SalesmanReportsPage, StatCard, MessagesSection, MyLeadsModal, AddLeadModal, LeadDetailDrawer } = shared;',
  '  const { T, fmtMoney, isToday, isThisMonth, isWithinDays, isUpcomingRenewalMonth, SalesmanReportsPage, StatCard, MessagesSection, MyLeadsModal, AddLeadModal, LeadDetailDrawer, VerificationStamp, NoLocationBadge } = shared;',
  'SalesmanView shared deps'
);
const oldSwitch = `  const switchTab = tab => {\n    if (tab === "add-contact") {\n      setShowAddLead(true);\n      return;\n    }\n    positions.current[mobileTab] = window.scrollY;\n    setVisited(current => ({ ...current, [tab]: true }));\n    setMobileTab(tab);\n  };`;
const newSwitch = `  const switchTab = tab => {\n    positions.current[mobileTab] = window.scrollY;\n    setVisited(current => ({ ...current, [tab]: true }));\n    setMobileTab(tab);\n  };`;
view = replaceOnce(view, oldSwitch, newSwitch, 'switchTab cleanup');
if (!view.includes('const [contactSearch, setContactSearch] = useState("");')) {
  view = view.replace('  const [showRenewals, setShowRenewals] = useState(false);','  const [showRenewals, setShowRenewals] = useState(false);\n  const [contactSearch, setContactSearch] = useState("");');
}
if (!view.includes('const contactRows = leads.filter')) {
  const marker = '  const leadPagingProps = { hasMore: hasMoreLeads, onLoadMore: loadMoreLeads, loadingMore: loadingMoreLeads, totalCount: totalLeadCount };';
  const insert = `${marker}\n  const contactNeedle = contactSearch.trim().toLowerCase();\n  const contactRows = leads.filter((lead) => !contactNeedle || [lead.owner, lead.business, lead.phone, lead.subLocation].some((value) => String(value || "").toLowerCase().includes(contactNeedle)));`;
  view = replaceOnce(view, marker, insert, 'contact rows');
}
view = view.replace('label="Add Lead" onClick={() => setShowAddLead(true)}', 'label="Add Deal" onClick={() => setShowAddLead(true)}');
view = view.replace('label="My Leads" onClick={() => phone ? switchTab("leads") : setShowMyLeads(true)}', 'label="My Deal" onClick={() => phone ? switchTab("leads") : setShowMyLeads(true)}');

if (!view.includes('className="engage-salesman-contacts"')) {
  const marker = '      {visited.tasks && <div hidden={!phone || mobileTab !== "tasks"}><TasksModal embedded active={phone && mobileTab === "tasks"} /></div>}';
  const block = `      {visited.contacts && <section hidden={!phone || mobileTab !== "contacts"} className="engage-salesman-contacts">\n        <div style={{ marginBottom: 14 }}>\n          <h2 style={{ fontSize: 18, margin: "0 0 4px" }}>Contacts</h2>\n          <div style={{ fontSize: 12, color: T.inkSoft }}>{totalLeadCount ?? leads.length} contact records · Your contacts</div>\n        </div>\n        <div style={{ position: "relative", marginBottom: 12 }}>\n          <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: T.inkSoft }} />\n          <input aria-label="Search contacts" value={contactSearch} onChange={(event) => setContactSearch(event.target.value)} placeholder="Search by contact, company, phone, or area…" style={{ width: "100%", padding: "9px 12px 9px 32px", borderRadius: 10, border: \`1px solid \${T.line}\`, fontSize: 13.5, boxSizing: "border-box" }} />\n        </div>\n        <MobileContacts leads={contactRows} onSelectLead={setViewingLead} renderVerification={(lead) => lead.hasLocation ? <VerificationStamp status={lead.verification} small /> : <NoLocationBadge small />} />\n        {hasMoreLeads && <button type="button" disabled={loadingMoreLeads} onClick={loadMoreLeads} style={{ width: "100%", marginTop: 12, padding: "10px 12px", borderRadius: 9, border: \`1px solid \${T.line}\`, background: "#fff", color: T.route, fontWeight: 800, cursor: loadingMoreLeads ? "default" : "pointer", opacity: loadingMoreLeads ? .65 : 1 }}>{loadingMoreLeads ? "Loading more…" : \`Load more contacts · \${Math.max(0, (totalLeadCount ?? leads.length) - leads.length)} remaining\`}</button>}\n      </section>}\n${marker}`;
  view = replaceOnce(view, marker, block, 'employee contacts section');
}
fs.writeFileSync(viewPath, view);

// 3) Pass verification components to SalesmanView from existing lead feature factory.
const leadPath = 'src/lead/LeadFeatures.jsx';
let lead = fs.readFileSync(leadPath, 'utf8');
lead = replaceOnce(
  lead,
  '        SalesmanReportsPage, StatCard, MessagesSection, MyLeadsModal, AddLeadModal, LeadDetailDrawer,\n      }}',
  '        SalesmanReportsPage, StatCard, MessagesSection, MyLeadsModal, AddLeadModal, LeadDetailDrawer, VerificationStamp, NoLocationBadge,\n      }}',
  'SalesmanView verification shared deps'
);
fs.writeFileSync(leadPath, lead);

// 4) Employee top bar: no duplicate top Menu; keep bell as the rightmost employee action.
const shellPath = 'src/app/AppShellFeatures.jsx';
let shell = fs.readFileSync(shellPath, 'utf8');
shell = replaceOnce(
  shell,
  '          <AppMenu onCollections={onOpenCollections} signedIn={!!session} role={session?.role} onSettings={onOpenSettings} onOnboarding={onOpenOnboarding} onQuotations={onOpenQuotations} onApprovals={onOpenApprovals} onDailyReports={session?.role === "salesman" ? onOpenDailyReports : undefined} />',
  '          {session?.role !== "salesman" && <AppMenu onCollections={onOpenCollections} signedIn={!!session} role={session?.role} onSettings={onOpenSettings} onOnboarding={onOpenOnboarding} onQuotations={onOpenQuotations} onApprovals={onOpenApprovals} onDailyReports={undefined} />}',
  'employee top menu removal'
);
fs.writeFileSync(shellPath, shell);

// 5) Update mobile smoke test to lock the requested UX in CI.
const smokePath = 'tests/smoke.spec.mjs';
let smoke = fs.readFileSync(smokePath, 'utf8');
const oldTest = `test('salesman mobile navigation uses Add Contact without duplicate My Leads', async ({ page }) => {\n  await page.setViewportSize({ width: 390, height: 844 });\n  await bootAs(page, { id: 'smoke-salesman', role: 'salesman', name: 'Smoke Salesman', fullName: 'Smoke Salesman', token: 'smoke-token' });\n  await expect(page.getByRole('button', { name: 'Add Contact' })).toBeVisible();\n  await expect(page.getByRole('button', { name: 'My Leads' })).toHaveCount(1);\n  await page.getByRole('button', { name: 'My Leads' }).click();\n  await noCrash(page);\n  await expect(page.locator('body')).toContainText(/My Leads|Kanban|Leads/i);\n});`;
const newTest = `test('salesman mobile navigation uses Contacts and dashboard Deal actions', async ({ page }) => {\n  await page.setViewportSize({ width: 390, height: 844 });\n  await bootAs(page, { id: 'smoke-salesman', role: 'salesman', name: 'Smoke Salesman', fullName: 'Smoke Salesman', token: 'smoke-token' });\n  await expect(page.getByRole('button', { name: 'Contacts' })).toBeVisible();\n  await expect(page.getByRole('button', { name: 'Add Deal' })).toBeVisible();\n  await expect(page.getByRole('button', { name: 'My Deal' })).toBeVisible();\n  await expect(page.getByRole('button', { name: 'Menu' })).toHaveCount(0);\n  await expect(page.getByRole('button', { name: /Notifications/i })).toBeVisible();\n  await page.getByRole('button', { name: 'Contacts' }).click();\n  await noCrash(page);\n  await expect(page.locator('body')).toContainText(/Contacts|Your contacts/i);\n  await page.getByRole('button', { name: 'Dashboard' }).click();\n  await page.getByRole('button', { name: 'My Deal' }).click();\n  await noCrash(page);\n  await expect(page.locator('body')).toContainText(/My Leads|Leads/i);\n});`;
smoke = replaceOnce(smoke, oldTest, newTest, 'salesman mobile smoke test');
fs.writeFileSync(smokePath, smoke);

console.log('Final employee UX prepared: Contacts tab, Add Deal/My Deal labels, existing My Leads reuse, top menu removed, bell retained.');
