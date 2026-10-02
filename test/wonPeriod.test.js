import test from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_WON_PERIOD_STORAGE_KEY,
  adminWonScopeMetrics,
  isWonDateInCurrentIstMonth,
  readAdminWonPeriod,
  writeAdminWonPeriod,
} from "../src/lead/wonPeriod.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

test("Admin Won period remembers This Month and All Time deterministically", () => {
  const storage = memoryStorage();
  assert.equal(readAdminWonPeriod(storage), "all");
  assert.equal(writeAdminWonPeriod("month", storage), "month");
  assert.equal(readAdminWonPeriod(storage), "month");
  assert.equal(writeAdminWonPeriod("all", storage), "all");
  assert.equal(readAdminWonPeriod(storage), "all");
  assert.equal(storage.getItem(ADMIN_WON_PERIOD_STORAGE_KEY), "all");
});

test("invalid saved Admin Won period safely resolves to All Time", () => {
  const storage = memoryStorage({ [ADMIN_WON_PERIOD_STORAGE_KEY]: "created-date" });
  assert.equal(readAdminWonPeriod(storage), "all");
});

test("This Month uses canonical Won Date in Asia/Kolkata month boundaries", () => {
  const now = new Date("2026-10-15T12:00:00+05:30");
  assert.equal(isWonDateInCurrentIstMonth("2026-10-03", now), true);
  assert.equal(isWonDateInCurrentIstMonth("2026-09-30T20:00:00Z", now), true, "20:00 UTC is already October in IST");
  assert.equal(isWonDateInCurrentIstMonth("2026-09-30T17:00:00Z", now), false);
  assert.equal(isWonDateInCurrentIstMonth("2026-08-01", now), false);
  assert.equal(isWonDateInCurrentIstMonth(null, now), false, "missing canonical Won Date must never fall back to creation date");
});

test("Admin Won outside KPI uses exactly the remembered period for count and value", () => {
  const now = new Date("2026-10-15T12:00:00+05:30");
  const leads = [
    { id: "oct", status: "won", wonDate: "2026-10-02", createdAt: new Date("2026-08-01T00:00:00Z"), dealValue: 15000 },
    { id: "sep", status: "won", wonDate: "2026-09-25", createdAt: new Date("2026-10-01T00:00:00Z"), dealValue: 30000 },
    { id: "hot", status: "hot", wonDate: "2026-10-03", dealValue: 50000 },
  ];

  const all = adminWonScopeMetrics(leads, "all", {}, now);
  assert.deepEqual({ ready: all.ready, count: all.count, value: all.value }, { ready: true, count: 2, value: 45000 });

  const month = adminWonScopeMetrics(leads, "month", {}, now);
  assert.deepEqual({ ready: month.ready, count: month.count, value: month.value }, { ready: true, count: 1, value: 15000 });
  assert.equal(month.leads[0].id, "oct", "creation date must not control the monthly Won card");
});

test("Admin Won monthly KPI refuses to guess when canonical Won Date is missing", () => {
  const now = new Date("2026-10-15T12:00:00+05:30");
  const leads = [{ id: "missing", status: "won", createdAt: new Date("2026-10-02T00:00:00Z"), dealValue: 12000 }];

  const unresolved = adminWonScopeMetrics(leads, "month", {}, now);
  assert.equal(unresolved.ready, false);
  assert.equal(unresolved.count, null);
  assert.equal(unresolved.value, null);

  const verified = adminWonScopeMetrics(leads, "month", { missing: "2026-10-05" }, now);
  assert.deepEqual({ ready: verified.ready, count: verified.count, value: verified.value }, { ready: true, count: 1, value: 12000 });
});
