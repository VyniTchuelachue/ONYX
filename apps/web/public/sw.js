/*
 * ONYX service worker.
 * - Pages: network first, falling back to the last cached copy, then to /offline.
 * - Build assets and brand images: cache first (their URLs are content-hashed or stable).
 * - API calls and React Server Component payloads: always live (never cached).
 * The technician list itself lives in localStorage (the offline pack), not here.
 */
const VERSION = 'onyx-v1';
const PAGES = `${VERSION}-pages`;
const STATIC = `${VERSION}-static`;
const PRECACHE = ['/', '/offline', '/assistant', '/technicians', '/brand/emblem.png', '/brand/wordmark.png', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (req.headers.get('RSC') === '1' || url.searchParams.has('_rsc')) return;

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/brand/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(req));
    return;
  }
  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req));
  }
});

/*
 * Phone alerts. The server words them (packages/core/src/notifications.ts); alerts that
 * share a tag replace each other, so one job never piles up on the lock screen.
 */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = typeof data.title === 'string' && data.title ? data.title : 'ONYX';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === 'string' ? data.body : '',
      tag: typeof data.tag === 'string' ? data.tag : undefined,
      renotify: typeof data.tag === 'string',
      lang: typeof data.lang === 'string' ? data.lang : undefined,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      vibrate: [120, 60, 120],
      data: { url: typeof data.url === 'string' ? data.url : '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Only ever open pages of this site.
  const target = new URL(event.notification.data?.url || '/', self.location.origin);
  const url = target.origin === self.location.origin ? target.href : self.location.origin + '/';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        if (open.url !== url && 'navigate' in open) {
          try {
            await open.navigate(url);
            return;
          } catch {
            /* not controlled by this worker yet: open a fresh window below */
          }
        } else {
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});

async function cacheFirst(req) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetchWithTimeout(req, 8000);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (
      (await cache.match(req, { ignoreSearch: true })) ||
      (await cache.match('/offline')) ||
      (await cache.match('/')) ||
      Response.error()
    );
  }
}

function fetchWithTimeout(req, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(req, { signal: controller.signal }).finally(() => clearTimeout(timer));
}
