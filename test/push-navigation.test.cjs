const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

for (const script of ['../public/push/push-sw.js', '../public/push-sw.js']) {
  function worker(windows = []) {
    const handlers = {}, opened = [], shown = [];
    const self = { location: { origin: 'https://app.example' }, addEventListener: (type, cb) => handlers[type] = cb,
      clients: { matchAll: async () => windows, openWindow: async url => opened.push(url) },
      registration: { showNotification: async (title, options) => shown.push({ title, options }) } };
    vm.runInNewContext(fs.readFileSync(require.resolve(script), 'utf8'), { self, URL });
    return { opened, shown, async fire(type, event) { let pending; handlers[type]({ ...event, waitUntil: p => pending = p }); await pending; } };
  }
  const notification = url => ({ notification: { close() {}, data: { url } } });

  test(script + ': cold notification click opens the briefing deep link', async () => {
    const w = worker(); await w.fire('notificationclick', notification('/#sales-briefing'));
    assert.deepEqual(w.opened, ['https://app.example/#sales-briefing']);
  });
  test(script + ': existing CRM tab receives notification in place without navigating or opening another tab', async () => {
    let message, focused = false, navigated = false;
    const client = { url: 'https://app.example/#lead=old', focused: true, navigate: async () => { navigated = true; }, postMessage: m => message = m, focus: async () => focused = true };
    const w = worker([client]); await w.fire('notificationclick', notification('/#lead=11111111-1111-4111-8111-111111111111'));
    assert.equal(navigated, false);
    assert.equal(message.type, 'OPEN_NOTIFICATION');
    assert.equal(message.url, 'https://app.example/#lead=11111111-1111-4111-8111-111111111111');
    assert.equal(focused, true);
    assert.equal(w.opened.length, 0);
  });
  test(script + ': already-focused app is preferred and customer share pages are not hijacked', async () => {
    const messages = [];
    const app = (url, focused) => ({ url, focused, postMessage: msg => messages.push({ focused, msg }), focus: async () => {} });
    const w = worker([
      app('https://app.example/q/quote', false),
      app('https://app.example/', false),
      app('https://app.example/#other', true),
    ]);
    await w.fire('notificationclick', notification('/#sales-briefing'));
    assert.equal(messages.length, 1);
    assert.equal(messages[0].focused, true);
    assert.equal(w.opened.length, 0);
  });
  test(script + ': generic notification opens in-app Notifications panel', async () => {
    const w = worker();
    await w.fire('notificationclick', notification('/'));
    assert.deepEqual(w.opened, ['https://app.example/#notifications']);
  });
  test(script + ': external notification URLs cannot navigate outside the app', async () => {
    const w = worker(); await w.fire('notificationclick', notification('https://other.example/'));
    assert.deepEqual(w.opened, ['https://app.example/']);
  });
  test(script + ': push preserves tag and briefing destination', async () => {
    const w = worker(); await w.fire('push', { data: { json: () => ({ title: 'Briefing', body: 'Hello', tag: 'day-1', url: '/#sales-briefing' }) } });
    assert.equal(w.shown[0].options.tag, 'day-1'); assert.equal(w.shown[0].options.data.url, '/#sales-briefing');
  });
}
