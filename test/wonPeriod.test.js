import test from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_WON_PERIOD_STORAGE_KEY,
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
