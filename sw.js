/* Night Arcade — service worker.
   Caches the shell + catalog + listed game shells so the library works offline.
   Bump VERSION when shipping shell or catalog changes. */
const VERSION = 'night-arcade-v1';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './catalog.json',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './games/the-last-lantern/',
  './games/the-last-lantern/index.html',
  './games/the-last-lantern/manifest.webmanifest',
  './games/the-last-lantern/icons/icon-192.png',
  './games/the-last-lantern/icons/icon-512.png',
  './games/the-last-lantern/icons/icon-maskable-512.png',
  './games/the-last-lantern/icons/apple-touch-icon.png',
  './games/the-last-lantern/icons/favicon-32.png',
  './games/the-last-lantern/screenshots/m-play.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const key = url.origin + url.pathname;
  const refresh = fetch(req).then(res => {
    if (res && res.ok && res.type === 'basic') {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(key, copy));
    }
    return res;
  });
  e.respondWith(
    caches.match(key).then(hit => hit || refresh.catch(() =>
      req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))
  );
  e.waitUntil(refresh.then(() => {}, () => {}));
});
