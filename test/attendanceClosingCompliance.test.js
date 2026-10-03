import test from "node:test";
import assert from "node:assert/strict";
import { closingComplianceForDay } from "../src/attendanceClosingCompliance.js";

test("not_required worked day is excluded from closing compliance", () => {
  assert.deepEqual(
    closingComplianceForDay({ hasSessions:true, statuses:["not_required"], requireClosing:false }),
    { required:false, completed:false }
  );
});

test("open worked day is excluded when closing policy is disabled", () => {
  assert.deepEqual(
    closingComplianceForDay({ hasSessions:true, statuses:[], requireClosing:false }),
    { required:false, completed:false }
  );
});

test("worked day without closing is pending when closing policy is required", () => {
  assert.deepEqual(
    closingComplianceForDay({ hasSessions:true, statuses:[], requireClosing:true }),
    { required:true, completed:false }
  );
});

test("submitted or skipped closing remains required and completed", () => {
  for (const status of ["submitted", "skipped"]) {
    assert.deepEqual(
      closingComplianceForDay({ hasSessions:true, statuses:[status], requireClosing:false }),
      { required:true, completed:true }
    );
  }
});

test("non-worked day never enters closing compliance", () => {
  assert.deepEqual(
    closingComplianceForDay({ hasSessions:false, statuses:[], requireClosing:true }),
    { required:false, completed:false }
  );
});
