/* ScanV Service Worker v6 — cache shell + static + service images */
const CACHE = 'scanv-v6';
const IMAGE_CACHE = 'scanv-v6-images';

function isAppImage(url) {
  try {
    const p = new URL(url).pathname;
    return /\/(services|home-models)\/.+\.(png|webp|jpe?g)$/i.test(p);
  } catch (_) {
    return false;
  }
}

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(() => Promise.resolve()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== IMAGE_CACHE).map(k => caches.delete(k)))
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

  if (isAppImage(url)) {
    e.respondWith(
      caches.open(IMAGE_CACHE).then(async cache => {
        const cached = await cache.match(e.request);
        const fetchAndCache = () => fetch(e.request).then(response => {
          if (response && response.status === 200) {
            cache.put(e.request, response.clone());
          }
          return response;
        });
        if (cached) {
          e.waitUntil(fetchAndCache().catch(() => {}));
          return cached;
        }
        try {
          return await fetchAndCache();
        } catch (_) {
          return cached;
        }
      })
    );
    return;
  }

  const isNavigation = e.request.mode === 'navigate';
  const isShell = url.endsWith('/index.html') || url.endsWith('/');

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
