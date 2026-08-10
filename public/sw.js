const CACHE = 'sune-v14';
const ASSETS = [
  './',
  'index.html',
  'de.js',
  'dc.js',
  'logic.js',
  'cube.js',
  'algs.js',
  'f2l.js',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'wake.mp4',
  'vendor/react.production.min.js',
  'vendor/react-dom.production.min.js',
  'fonts/fonts.css',
  'fonts/outfit-var.woff2',
  'fonts/plexmono-400.woff2',
  'fonts/plexmono-500.woff2',
  'fonts/plexmono-600.woff2'
];
self.addEventListener('install', e => {
  // cache:'reload' bypasses the browser HTTP cache — precaching must never
  // capture a stale copy that the HTTP cache still considers fresh
  const fresh = u => { try { return new Request(u, { cache: 'reload' }); } catch (err) { return u; } };
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(fresh))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
// Network-first so deploys show up immediately; cache fallback keeps it fully offline-capable.
// cache:'no-cache' forces revalidation with the server — without it, this "network"
// fetch is silently answered by the browser HTTP cache and deploys never land.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  let req = e.request;
  try { req = new Request(e.request.url, { cache: 'no-cache' }); } catch (err) {}
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
