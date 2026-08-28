/* Service worker: fa que la web tiri sense connexió.
   Puja VERSION quan canviïn els fitxers i els navegadors se'ls tornaran a baixar. */
const VERSION = 'h16f05ac63a';
const CACHE   = 'kanoodle-' + VERSION;

const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './css/fonts.css',
  './fonts/bricolage-grotesque-600-latin.woff2',
  './fonts/bricolage-grotesque-600-latin-ext.woff2',
  './fonts/ibm-plex-sans-400-latin.woff2',
  './fonts/ibm-plex-sans-400-latin-ext.woff2',
  './fonts/ibm-plex-mono-500-latin.woff2',
  './fonts/ibm-plex-mono-500-latin-ext.woff2',
  './fonts/ibm-plex-mono-600-latin.woff2',
  './fonts/ibm-plex-mono-600-latin-ext.woff2',
  './js/app.js',
  './js/api.js',
  './js/solver.js',
  './js/worker.js',
  './data/puzzles.json',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', e => {
  // skipWaiting: si no, la versió nova es quedaria esperant fins que
  // es tanquessin totes les pestanyes, i recarregar no serviria de res.
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        if (res.ok || res.type === 'opaque') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => req.mode === 'navigate' ? caches.match('./index.html') : Promise.reject());
    })
  );
});
