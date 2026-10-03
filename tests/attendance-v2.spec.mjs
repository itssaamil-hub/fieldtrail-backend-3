import { test, expect } from "@playwright/test";
import fs from "node:fs";

const ui = fs.readFileSync(new URL("../src/AttendanceReportV2.jsx", import.meta.url), "utf8");
const api = fs.readFileSync(new URL("../src/attendanceV2Api.js", import.meta.url), "utf8");
const reports = fs.readFileSync(new URL("../src/admin/AdminReportsPage.jsx", import.meta.url), "utf8");

test("Attendance Report uses canonical V2 backend instead of client totals", () => {
  expect(ui).toContain("attendanceV2Api.report(params)");
  expect(ui).toContain("report?.totals");
  expect(reports).toContain('import("../AttendanceReportV2.jsx")');
});

test("Attendance V2 exposes approved admin workflows", () => {
  expect(api).toContain("/attendance-v2/exceptions");
  expect(api).toContain("/attendance-v2/sessions/${id}/close");
  expect(api).toContain("/attendance-v2/export");
  expect(ui).toContain("Close stale session");
  expect(ui).toContain("Mark Leave");
  expect(ui).toContain("Mark Weekly Off");
  expect(ui).toContain("Mark Holiday");
});

test("expected attendance times remain optional and are never hard-coded", () => {
  expect(ui).toContain('type="time"');
  expect(ui).toContain("Expected time not configured");
  expect(ui).not.toContain('expectedStartTime:"10:00"');
  expect(ui).not.toContain('expectedEndTime:"19:00"');
});

test("anomaly and closing states stay visibly separate", () => {
  expect(ui).toContain('missing_end:"bad"');
  expect(ui).toContain('closing_pending:"warn"');
  expect(ui).toContain("detail.staleOpen");
  expect(ui).toContain("detail.closing.required");
});
