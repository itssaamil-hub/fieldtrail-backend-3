import { test, expect } from "@playwright/test";
import { closingComplianceForDay } from "../src/attendanceClosingCompliance.js";

test("not_required worked day is excluded from closing compliance", () => {
  expect(closingComplianceForDay({ hasSessions:true, statuses:["not_required"], requireClosing:false })).toEqual({ required:false, completed:false });
});

test("open worked day is excluded when closing policy is disabled", () => {
  expect(closingComplianceForDay({ hasSessions:true, statuses:[], requireClosing:false })).toEqual({ required:false, completed:false });
});

test("worked day without closing is pending when closing is required", () => {
  expect(closingComplianceForDay({ hasSessions:true, statuses:[], requireClosing:true })).toEqual({ required:true, completed:false });
});

test("submitted and skipped closings remain required and completed", () => {
  for (const status of ["submitted", "skipped"]) {
    expect(closingComplianceForDay({ hasSessions:true, statuses:[status], requireClosing:false })).toEqual({ required:true, completed:true });
  }
});

test("non-worked day never enters closing compliance", () => {
  expect(closingComplianceForDay({ hasSessions:false, statuses:[], requireClosing:true })).toEqual({ required:false, completed:false });
});
