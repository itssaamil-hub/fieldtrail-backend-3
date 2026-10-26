const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const source = readFileSync(path.join(__dirname, "../src/app/AppShellFeatures.jsx"), "utf8");

test("push preferences have their own Settings page and a back path", () => {
  assert.match(source, /const \[pushSettingsPage, setPushSettingsPage\] = useState\(false\)/);
  assert.match(source, /if \(pushSettingsPage\) \{[\s\S]*?<SettingsSurface desktopPage=\{desktopPage\} title="Push Notifications"/);
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
