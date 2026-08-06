const CACHE = 'sune-v6';
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
  'vendor/react.production.min.js',
  'vendor/react-dom.production.min.js',
  'fonts/fonts.css',
  'fonts/outfit-var.woff2',
  'fonts/plexmono-400.woff2',
  'fonts/plexmono-500.woff2',
  'fonts/plexmono-600.woff2'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
// Network-first so deploys show up immediately; cache fallback keeps it fully offline-capable.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
