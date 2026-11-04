import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { daysUntilRenewal, renewalCountdown, nearestRenewalCountdown } from "../src/renewalCountdown.js";
const read = path => readFileSync(new URL("../src/" + path, import.meta.url), "utf8");

const today = new Date("2026-11-05T01:20:00+05:30");

test("renewal countdown is based on calendar dates in India", () => {
  assert.equal(daysUntilRenewal("2026-11-24", today), 19);
  assert.equal(renewalCountdown("2026-11-24", today), "19 days left");
  assert.equal(renewalCountdown("2026-11-06", today), "1 day left");
  assert.equal(renewalCountdown("2026-11-05", today), "Due today");
  assert.equal(renewalCountdown("2026-11-04", today), "1 day overdue");
  assert.equal(renewalCountdown("2026-11-03", today), "2 days overdue");
  assert.equal(renewalCountdown("2026-12-01", today), "26 days left");
  assert.equal(renewalCountdown("2026-11-24T00:00:00.000Z", today), "19 days left");
});
test("India timezone boundary does not introduce a one-day error", () => {
  assert.equal(renewalCountdown("2026-11-06", new Date("2026-11-05T23:59:59+05:30")), "1 day left");
  assert.equal(renewalCountdown("2026-11-06", new Date("2026-11-06T00:00:01+05:30")), "Due today");
});
test("month-only and invalid dates never get invented day counts", () => {
  for (const value of [null, undefined, "", "November", "2026-02-30", "invalid"]) {
    assert.equal(daysUntilRenewal(value, today), null);
    assert.equal(renewalCountdown(value, today), "");
  }
});
test("KPI shows the nearest real date while preserving count calculations", () => {
  assert.equal(nearestRenewalCountdown([
    {renewalDate:"2026-11-24"}, {renewalDate:"2026-11-16"}, {renewalDate:null,renewalMonth:"November"}
  ],today),"11 days left");
  assert.equal(nearestRenewalCountdown([{renewalDate:null,renewalMonth:"November"}],today),"");
  assert.equal(nearestRenewalCountdown([{renewalDate:"2026-11-05"}],today),"Due today");
  assert.equal(nearestRenewalCountdown([{renewalDate:"2026-11-03"}],today),"");
});
test("only renewal KPI text changes; all existing KPI labels, counts and links remain", () => {
  const admin=read("admin/AdminDashboardPanel.jsx");
  const employee=read("salesman/SalesmanView.jsx");
  assert.match(admin,/label="Renewals Due" sub=\{renewalNearest \|\| "next 30 days"\} value=\{upcomingRenewals\.length\}/);
  assert.match(admin,/onClick=\{\(\) => onOpenStatLeads\(\{ title: "Renewals Due \(Next 30 Days\)", leads: upcomingRenewals \}\)\}/);
  assert.match(employee,/label="Renewals" value=\{renewalCount\} sub=\{renewalNearest \|\| "next 30 days"\}/);
  assert.match(employee,/const renewalCount = serverMetrics\.renewalsDue \?\? leadSummary\?\.renewalsDue \?\? upcomingRenewals\.length/);
});
test("only renewal reports and KPI-opened renewal lists gain per-lead countdown", () => {
  const report=read("reports/ReportFeatures.jsx");
  const list=read("lead/LeadFeaturesCore.jsx");
  assert.match(report,/function RenewalsReport\(\{ leads \}\)/);
  assert.match(report,/l\.renewalDate && renewalCountdown\(l\.renewalDate\)/);
  assert.match(report,/l\.renewalDate \|\| l\.renewalMonth \|\| "—"/);
  assert.match(list,/const isRenewalList = title\.startsWith\("Renewals Due"\)/);
  assert.match(list,/isRenewalList && renewalCountdown\(l\.renewalDate\)/);
  assert.match(list,/const isWonModal = title === "Won Leads"/);
});
