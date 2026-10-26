// Separate push registration; the root PWA worker continues to cache the app.
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(data.title || 'Engage', {
    body: data.body || '', icon: '/pwa-192.png', badge: '/pwa-192.png',
    ...(data.tag ? { tag: data.tag } : {}),
    data: { url: data.url || '/' },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    let target;
    try { target = new URL(event.notification.data?.url || '/', self.location.origin); }
    catch { target = new URL('/', self.location.origin); }
    if (target.origin !== self.location.origin) {
      // Never follow off-site destinations from a push payload.
      target = new URL('/', self.location.origin);
    } else if ((target.pathname === '/' || target.pathname === '/index.html') && !target.hash && !target.search) {
      // Generic alerts (Start/End Day, digests, targets) open the in-app inbox.
      target.hash = '#notifications';
    }

    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // An already-open Engage window should stay on its current page; React
    // opens the matching CRM sheet/drawer without reloading or spawning a tab.
    const appWindows = windows.filter(client => {
      try {
        const url = new URL(client.url);
        return url.origin === self.location.origin && (url.pathname === '/' || url.pathname === '/index.html');
      } catch { return false; }
    }).sort((a, b) => Number(Boolean(b.focused)) - Number(Boolean(a.focused)));
    for (const client of appWindows) {
      try {
        await client.focus();
        client.postMessage({ type: 'OPEN_NOTIFICATION', url: target.href });
        return;
      } catch { /* A closed/unavailable tab should not block opening the app. */ }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target.href);
  })());
});
