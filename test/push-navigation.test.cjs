const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function worker(windows = []) {
  const handlers = {}, opened = [], shown = [];
  const self = { location: { origin: 'https://app.example' }, addEventListener: (type, cb) => handlers[type] = cb,
    clients: { matchAll: async () => windows, openWindow: async url => opened.push(url) },
    registration: { showNotification: async (title, options) => shown.push({ title, options }) } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/push/push-sw.js'), 'utf8'), { self, URL });
  return { opened, shown, async fire(type, event) { let pending; handlers[type]({ ...event, waitUntil: p => pending = p }); await pending; } };
}
const notification = url => ({ notification: { close() {}, data: { url } } });
test('cold notification click opens the briefing deep link', async () => {
  const w = worker(); await w.fire('notificationclick', notification('/#sales-briefing'));
  assert.deepEqual(w.opened, ['https://app.example/#sales-briefing']);
});
test('existing tab navigates, receives repeated-click message, and focuses', async () => {
  let navigated, message, focused = false;
  const client = { url: 'https://app.example/', navigate: async url => { navigated = url; return client; }, postMessage: m => message = m, focus: async () => focused = true };
  const w = worker([client]); await w.fire('notificationclick', notification('/#sales-briefing'));
  assert.equal(navigated, 'https://app.example/#sales-briefing'); assert.equal(message.type, 'OPEN_NOTIFICATION'); assert.equal(focused, true); assert.equal(w.opened.length, 0);
});
test('external notification URLs cannot navigate outside the app', async () => {
  const w = worker(); await w.fire('notificationclick', notification('https://other.example/'));
  assert.deepEqual(w.opened, ['https://app.example/']);
});
test('push preserves daily deduplication tag and briefing destination', async () => {
  const w = worker(); await w.fire('push', { data: { json: () => ({ title: 'Briefing', body: 'Hello', tag: 'day-1', url: '/#sales-briefing' }) } });
  assert.equal(w.shown[0].options.tag, 'day-1'); assert.equal(w.shown[0].options.data.url, '/#sales-briefing');
});
