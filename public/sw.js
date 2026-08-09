/* ScanV Service Worker v4 */
const CACHE='scanv-v4';
const STATIC=['/','/index.html','/manifest.json','/favicon.ico'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC).catch(()=>{})));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=e.request.url;
  if(url.includes('supabase.co')||url.includes('ipify.org')||url.includes('nominatim')||url.includes('razorpay'))return;
  e.respondWith(caches.match(e.request).then(cached=>{
    if(cached)return cached;
    return fetch(e.request).then(response=>{
      if(!response||response.status!==200||response.type!=='basic')return response;
      const clone=response.clone();
      caches.open(CACHE).then(c=>c.put(e.request,clone));
      return response;
    }).catch(()=>caches.match('/index.html'));
  }));
});