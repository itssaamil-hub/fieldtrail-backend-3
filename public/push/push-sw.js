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
    if (target.origin !== self.location.origin) target = new URL('/', self.location.origin);
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      try {
        // Hash navigation keeps the current app alive while opening the correct panel.
        const navigated = await client.navigate(target.href);
        if (navigated) {
          navigated.postMessage({ type: 'OPEN_NOTIFICATION', url: target.href });
          await navigated.focus();
          return;
        }
      } catch { /* Try the next window, or open a new one below. */ }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target.href);
  })());
});
