const fs = require('fs');

const navPath = 'src/AdminMobileNav.jsx';
let nav = fs.readFileSync(navPath, 'utf8');
nav = nav.replace('import { Gauge, Contact2, Handshake, Users, Wallet, List, ClipboardList, MessageSquare, Menu } from "lucide-react";', 'import { Gauge, Contact2, Handshake, Users, Wallet, ClipboardList, MessageSquare, Menu } from "lucide-react";');
const oldTabs = 'export const salesmanTabs = [["dashboard", "Dashboard", Gauge], ["leads", "My Leads", List], ["tasks", "Tasks", ClipboardList], ["messages", "Messages", MessageSquare], ["more", "More", Menu]];';
const newTabs = 'export const salesmanTabs = [["dashboard", "Dashboard", Gauge], ["add-contact", "Add Contact", Contact2], ["tasks", "Tasks", ClipboardList], ["messages", "Messages", MessageSquare], ["more", "More", Menu]];';
if (!nav.includes(oldTabs) && !nav.includes(newTabs)) throw new Error('salesmanTabs anchor not found');
nav = nav.replace(oldTabs, newTabs);
fs.writeFileSync(navPath, nav);

const viewPath = 'src/salesman/SalesmanView.jsx';
let view = fs.readFileSync(viewPath, 'utf8');
const oldSwitch = `  const switchTab = tab => {\n    positions.current[mobileTab] = window.scrollY;\n    setVisited(current => ({ ...current, [tab]: true }));\n    setMobileTab(tab);\n  };`;
const newSwitch = `  const switchTab = tab => {\n    if (tab === "add-contact") {\n      setShowAddLead(true);\n      return;\n    }\n    positions.current[mobileTab] = window.scrollY;\n    setVisited(current => ({ ...current, [tab]: true }));\n    setMobileTab(tab);\n  };`;
if (!view.includes(oldSwitch) && !view.includes(newSwitch)) throw new Error('switchTab anchor not found');
view = view.replace(oldSwitch, newSwitch);

const oldButton = '<BigButton T={T} icon={List} label="My Leads" onClick={() => setShowMyLeads(true)} />';
const newButton = '<BigButton T={T} icon={List} label="My Leads" onClick={() => phone ? switchTab("leads") : setShowMyLeads(true)} />';
if (!view.includes(oldButton) && !view.includes(newButton)) throw new Error('My Leads button anchor not found');
view = view.replace(oldButton, newButton);
fs.writeFileSync(viewPath, view);

const smokePath = 'tests/smoke.spec.mjs';
let smoke = fs.readFileSync(smokePath, 'utf8');
const marker = "test('salesman shell renders without crash', async ({ page }) => {";
if (!smoke.includes("salesman mobile navigation uses Add Contact without duplicate My Leads")) {
  const testBlock = `test('salesman mobile navigation uses Add Contact without duplicate My Leads', async ({ page }) => {\n  await page.setViewportSize({ width: 390, height: 844 });\n  await bootAs(page, { id: 'smoke-salesman', role: 'salesman', name: 'Smoke Salesman', fullName: 'Smoke Salesman', token: 'smoke-token' });\n  await expect(page.getByRole('button', { name: 'Add Contact' })).toBeVisible();\n  await expect(page.getByRole('button', { name: 'My Leads' })).toHaveCount(1);\n  await page.getByRole('button', { name: 'My Leads' }).click();\n  await noCrash(page);\n  await expect(page.locator('body')).toContainText(/My Leads|Kanban|Leads/i);\n});\n\n`;
  if (!smoke.includes(marker)) throw new Error('salesman smoke test marker not found');
  smoke = smoke.replace(marker, testBlock + marker);
  fs.writeFileSync(smokePath, smoke);
}

console.log('Salesman mobile nav updated: Add Contact in bottom nav, dashboard My Leads opens embedded lead view.');
