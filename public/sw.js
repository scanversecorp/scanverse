/* ScanV Service Worker v14 — precache webp tiles + stale-while-revalidate images */
const CACHE = 'scanv-v14';
const IMAGE_CACHE = 'scanv-v14-images';

const PRECACHE_IMAGES = [
  '/home-models/beauty.webp',
  '/home-models/cloud.webp',
  '/home-models/delivery.webp',
  '/home-models/food.webp',
  '/home-models/four-wheeler.webp',
  '/home-models/health.webp',
  '/home-models/household.webp',
  '/home-models/legal.webp',
  '/home-models/property.webp',
  '/home-models/repairs.webp',
  '/home-models/two-wheeler.webp',
  '/home-models/vip.webp',
  '/services/bathroom-deep.webp',
  '/services/bathroom-help.webp',
  '/services/beauty/beard-grooming.webp',
  '/services/beauty/facial.webp',
  '/services/beauty/haircut-men.webp',
  '/services/beauty/haircut-women.webp',
  '/services/beauty/makeup.webp',
  '/services/beauty/mani-pedi.webp',
  '/services/beauty/mens-facial.webp',
  '/services/beauty/massage.webp',
  '/services/beauty/mehendi.webp',
  '/services/beauty/threading.webp',
  '/services/care-plan.webp',
  '/services/cloud/backup.webp',
  '/services/cloud/datacenter.webp',
  '/services/cloud/dc-operate.webp',
  '/services/cloud/dr-pack.webp',
  '/services/cloud/edtech-lms.webp',
  '/services/cloud/hardware.webp',
  '/services/cloud/hybrid.webp',
  '/services/cloud/iaas.webp',
  '/services/cloud/infra-audit.webp',
  '/services/cloud/maas.webp',
  '/services/cloud/managed.webp',
  '/services/cloud/network.webp',
  '/services/cloud/office-box.webp',
  '/services/cloud/ott-pack.webp',
  '/services/cloud/paas.webp',
  '/services/cloud/saas.webp',
  '/services/cloud/training.webp',
  '/services/cloud/video.webp',
  '/services/delivery/bulk.webp',
  '/services/delivery/document.webp',
  '/services/delivery/grocery.webp',
  '/services/delivery/intercity.webp',
  '/services/delivery/parcel.webp',
  '/services/delivery/sameday.webp',
  '/services/dishwashing.webp',
  '/services/fan-clean.webp',
  '/services/flat-clean.webp',
  '/services/food/breakfast.webp',
  '/services/food/catering.webp',
  '/services/food/festival.webp',
  '/services/food/office.webp',
  '/services/food/restaurant.webp',
  '/services/food/tiffin.webp',
  '/services/four-wheeler/deep-clean.webp',
  '/services/four-wheeler/detailing.webp',
  '/services/four-wheeler/fixing.webp',
  '/services/four-wheeler/maintenance.webp',
  '/services/four-wheeler/mechanic.webp',
  '/services/four-wheeler/pickup.webp',
  '/services/four-wheeler/sanitize.webp',
  '/services/four-wheeler/washing.webp',
  '/services/health/checkup.webp',
  '/services/health/doctor.webp',
  '/services/health/elder.webp',
  '/services/health/lab.webp',
  '/services/health/nursing.webp',
  '/services/health/pharmacy.webp',
  '/services/health/specialist.webp',
  '/services/health/vaccine.webp',
  '/services/house-help.webp',
  '/services/ironing.webp',
  '/services/kitchen-deep.webp',
  '/services/kitchen-help.webp',
  '/services/laundry.webp',
  '/services/legal/consult.webp',
  '/services/legal/contract.webp',
  '/services/legal/court.webp',
  '/services/legal/doc-draft.webp',
  '/services/legal/family.webp',
  '/services/legal/notary.webp',
  '/services/legal/property-reg.webp',
  '/services/legal/rental-agreement.webp',
  '/services/property/buy-sell.webp',
  '/services/property/commercial.webp',
  '/services/property/legal-check.webp',
  '/services/property/loan.webp',
  '/services/property/rent.webp',
  '/services/property/site-visit.webp',
  '/services/quick-clean.webp',
  '/services/repairs/ac-service.webp',
  '/services/repairs/appliance-mount.webp',
  '/services/repairs/carpenter.webp',
  '/services/repairs/electrician.webp',
  '/services/repairs/geyser.webp',
  '/services/repairs/plumber.webp',
  '/services/repairs/ro-purifier.webp',
  '/services/repairs/washing-machine.webp',
  '/services/sofa-clean.webp',
  '/services/two-wheeler/battery.webp',
  '/services/two-wheeler/deep-clean.webp',
  '/services/two-wheeler/fixing.webp',
  '/services/two-wheeler/mechanic.webp',
  '/services/two-wheeler/pickup.webp',
  '/services/two-wheeler/polish.webp',
  '/services/two-wheeler/towing.webp',
  '/services/two-wheeler/washing.webp',
  '/services/vip/airport.webp',
  '/services/vip/assistant.webp',
  '/services/vip/concierge.webp',
  '/services/vip/dining.webp',
  '/services/vip/event.webp',
  '/services/vip/priority.webp',
  '/services/window-clean.webp',
];

function isAppImage(url) {
  try {
    const p = new URL(url).pathname;
    return /\/(services|home-models)\/.+\.(png|webp|jpe?g)$/i.test(p);
  } catch (_) {
    return false;
  }
}

function cacheLooksValid(response) {
  if (!response || !response.ok) return false;
  const len = response.headers.get('content-length');
  return !len || parseInt(len, 10) > 256;
}

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(IMAGE_CACHE).then(cache =>
      Promise.allSettled(
        PRECACHE_IMAGES.map(path =>
          cache.add(new Request(path, { cache: 'reload' }))
        )
      )
    )
  );
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
          if (response && response.status === 200 && cacheLooksValid(response)) {
            cache.put(e.request, response.clone());
          }
          return response;
        });
        if (cached && cacheLooksValid(cached)) {
          e.waitUntil(fetchAndCache().catch(() => {}));
          return cached;
        }
        if (cached) await cache.delete(e.request);
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
      const isMainJs = /\/static\/js\/main\.[a-f0-9]+\.js$/i.test(new URL(url).pathname);
      if (isMainJs) {
        return fetch(e.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return response;
        }).catch(() => cached);
      }
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
