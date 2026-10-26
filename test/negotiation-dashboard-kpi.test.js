import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const admin = readFileSync(new URL("../src/admin/AdminDashboardPanel.jsx", import.meta.url), "utf8");
const employee = readFileSync(new URL("../src/salesman/SalesmanView.jsx", import.meta.url), "utf8");

test("Admin Negotiation KPI reuses Won inline amount layout for phone and PC", () => {
  assert.match(admin, /const negotiationDealValue = serverMetrics\.negotiationValue \?\?/);
  assert.match(admin, /label="In Negotiation" value=\{negotiationValue\} sub=\{fmtMoney\(negotiationDealValue\)\} subInline/);
  assert.match(admin, /label="Won" value=\{wonValue\} sub=\{wonSub\} subInline/);
  assert.match(admin, /const dashboardLeads = dashboardSalesman === "all" \? leads : leads\.filter/);
});

test("Employee Negotiation KPI shows a value with the unchanged Won card behavior", () => {
  assert.match(employee, /const negotiationDealValue = serverMetrics\.negotiationValue \?\? leadSummary\?\.negotiationValue/);
  assert.match(employee, /label="Negotiation" value=\{negotiationCount\} sub=\{negotiationDealValue > 0 \? fmtMoney\(negotiationDealValue\) : undefined\}/);
  assert.match(employee, /label="Won" value=\{wonCount\} sub=\{wonValue > 0 \? fmtMoney\(wonValue\) : undefined\}/);
});

test("Employee phone Negotiation amount follows the existing Won position only when present", () => {
  const shell = readFileSync(new URL("../src/app/AppShellFeatures.jsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/salesman-dashboard-cards.css", import.meta.url), "utf8");
  assert.match(shell, /data-kpi-has-amount=\{labelText === "Negotiation" && Boolean\(sub\) \? "true" : undefined\}/);
  assert.match(css, /@media \(max-width: 899px\)/);
  assert.match(css, /data-kpi="negotiation"\]\[data-kpi-has-amount="true"\] > div:nth-child\(3\),\s*\.engage-salesman-water-card\[data-kpi="won"\] > div:nth-child\(3\)/);
  assert.match(css, /data-kpi="negotiation"\]\[data-kpi-has-amount="true"\] > div:nth-child\(4\),\s*\.engage-salesman-water-card\[data-kpi="won"\] > div:nth-child\(4\)/);
});
