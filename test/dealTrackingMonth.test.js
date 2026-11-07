import test from "node:test";
import assert from "node:assert/strict";
import { currentTrackingMonth, trackingMonthOptions, applyTrackedDealFilters } from "../src/utils/dealTrackingMonth.js";

test("Tracking uses India calendar, including month rollover", () => {
  assert.equal(currentTrackingMonth(new Date("2026-10-31T18:29:59Z")), "2026-10");
  assert.equal(currentTrackingMonth(new Date("2026-10-31T18:30:00Z")), "2026-11");
  assert.deepEqual(trackingMonthOptions(2, new Date("2026-11-07T05:00:00Z")).map(x => x.value), ["2026-11", "2026-10"]);
});

test("Admin filters retain old deals selected this month and match existing criteria", () => {
  const lead = { id: "old", salesmanId: "anand", status: "hot", business: "Test Café",
    owner: "Owner", phone: "123", subLocation: "Gomti Nagar", createdAt: new Date("2024-01-20T10:00:00Z") };
  const other = { ...lead, id: "other", salesmanId: "rahul" };
  const cityByEmployee = new Map([["anand", "Lucknow"], ["rahul", "Kanpur"]]);
  assert.deepEqual(applyTrackedDealFilters([lead, other], {
    employeeId: "anand", status: "hot", city: "Lucknow", search: "café", cityByEmployee,
  }).map(row => row.id), ["old"]);
  assert.deepEqual(applyTrackedDealFilters([lead, other], {
    status: "won", cityByEmployee,
  }), []);
  assert.equal(applyTrackedDealFilters([lead], { date: "2026-11-07", cityByEmployee }).length, 0);
});
