/* ScanV Service Worker v5 — network-first shell, cache static assets */
const CACHE = 'scanv-v5';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(() => Promise.resolve()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = e.request.url;
  if (
    url.includes('supabase.co') ||
    url.includes('ipify.org') ||
    url.includes('nominatim.openstreetmap.org') ||
    url.includes('razorpay.com') ||
    url.includes('api.github.com')
  ) return;

  const isNavigation = e.request.mode === 'navigate';
  const isShell = url.endsWith('/index.html') || url.endsWith('/');

  /* Always fetch fresh HTML shell and SPA navigations (avoids stale legal-page bundles). */
  if (isNavigation || isShell) {
    e.respondWith(
      fetch(e.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      }).catch(() => caches.match(e.request).then(c => c || caches.match('/index.html')))
    );
    return;
  }

  /* Cache-first for hashed static assets only. */
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (!response || response.status !== 200) return response;
        if (url.includes('/static/')) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      });
    })
  );
});
