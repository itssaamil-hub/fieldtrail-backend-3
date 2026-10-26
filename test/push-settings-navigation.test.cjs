const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const source = readFileSync(path.join(__dirname, "../src/app/AppShellFeatures.jsx"), "utf8");

test("push preferences have their own Settings page and a back path", () => {
  assert.match(source, /const \[pushSettingsPage, setPushSettingsPage\] = useState\(false\)/);
  assert.match(source, /if \(pushSettingsPage\) \{[\s\S]*?<SettingsSurface desktopPage=\{desktopPage\} fullPushPage title="Push Notifications"/);
  assert.match(source, /data-full-push-page="true"/);
  assert.match(source, /import "\.\/push-notification-settings\.css"/);
  assert.match(source, /onClose=\{\(\) => setPushSettingsPage\(false\)\}/);
  assert.match(source, /data-open-push-settings="true" onClick=\{\(\) => setPushSettingsPage\(true\)\}/);
  assert.match(source, /data-push-settings-page="true"/);
});

test("main Settings page no longer renders per-event push preference controls", () => {
  const start = source.indexOf("function SettingsModal(");
  const end = source.indexOf("function StatCard(", start);
  const modal = source.slice(start, end);
  assert.ok(start > 0 && end > start);
  assert.ok(!modal.includes("PREF_GROUPS.map"));
  assert.ok(!modal.includes("push.setPreference("));
  assert.ok(modal.includes("PushNotificationSettings push={push} isAdmin={isAdmin}"));
});

test("dedicated page keeps existing subscribe and preference actions with explanatory labels", () => {
  const page = source.slice(source.indexOf("function PushNotificationSettings("), source.indexOf("function SettingsModal("));
  assert.match(page, /onClick=\{push.enable\}/);
  assert.match(page, /onClick=\{push.disable\}/);
  assert.match(page, /push.setPreference\(key, event.target.checked\)/);
  assert.match(page, /Scheduled reminders are sent only when their backend job runs successfully/);
  assert.match(source, /One push per inactivity period/);
  assert.match(source, /dayStartDigest/);
});

test("push settings show only role-delivered notification types", () => {
  const groups = source.slice(source.indexOf("const PUSH_NOTIFICATION_GROUPS"), source.indexOf("const PUSH_VERIFICATION_STEPS"));
  const admin = groups.slice(groups.indexOf("admin:"), groups.indexOf("salesman:"));
  const salesman = groups.slice(groups.indexOf("salesman:"));
  for (const key of ["hotLead", "statusConversation", "statusDemo", "statusNegotiation", "dealWon", "targetMilestone", "dayStartedEnded", "dayClosingMissing", "dayActivitySummary", "dayStartDigest"]) {
    assert.match(admin, new RegExp('"' + key + '"'));
  }
  for (const key of ["followUpDue", "renewalDue", "salesBriefing", "inactiveLead"]) assert.doesNotMatch(admin, new RegExp('"' + key + '"'));
  for (const key of ["hotLead", "followUpDue", "renewalDue", "inactiveLead", "salesBriefing"]) assert.match(salesman, new RegExp('"' + key + '"'));
  for (const key of ["statusConversation", "statusNegotiation", "statusDemo", "dayStartDigest", "dealWon"]) assert.doesNotMatch(salesman, new RegExp('"' + key + '"'));
});

test("Test & Verify is explicit, per-account, and cannot claim delivery from acceptance alone", () => {
  assert.match(source, /role="tablist" aria-label="Push Notifications sections"/);
  assert.match(source, /setActiveTab\("diagnostics"\)/);
  assert.match(source, /api\.notificationsDebug\(\)/);
  assert.match(source, /onClick=\{sendTestNotification\}/);
  assert.match(source, /api\.notificationsTest\(\)/);
  assert.match(source, /testSending \|\| !push\.supported \|\| !push\.subscribed/);
  assert.match(source, /Acceptance is not proof that an alert appeared/);
  assert.match(source, /The test bypasses category preferences/);
  assert.match(source, /user-confirmed/);
  assert.match(source, /setCheckedSteps/);
});
test("API uses authenticated self-only debug and push test endpoints", () => {
  const apiSource = readFileSync(path.join(__dirname, "../src/api.js"), "utf8");
  assert.match(apiSource, /notificationsDebug: \(\) => request\("\/notifications\/debug"\)/);
  assert.match(apiSource, /notificationsTest: \(\) => request\("\/notifications\/test", \{ method: "POST" \}\)/);
});
