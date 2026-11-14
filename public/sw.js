/* LIFE ASCENSION push worker.
 * No fetch handler: authenticated pages stay on Next's own caching and auth.
 * notification tag + renotify:false replaces a daily-progress notice in place.
 */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === 'string' && data.title ? data.title : 'LIFE ASCENSION';
  const body = typeof data.body === 'string' ? data.body : '';
  const tag = typeof data.tag === 'string' && data.tag ? data.tag : 'life-ascension';
  const url = safePath(data.url);
  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag,
    renotify: false,
    data: { url },
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(safePath(event.notification.data && event.notification.data.url), self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin)) {
        return client.focus().then((focused) => (focused.navigate ? focused.navigate(url) : focused));
      }
    }
    return self.clients.openWindow(url);
  }));
});

function safePath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || value.includes('://')) {
    return '/quests';
  }
  return value;
}
