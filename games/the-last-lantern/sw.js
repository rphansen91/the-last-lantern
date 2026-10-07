/* The Last Lantern — service worker: cache the whole (tiny) game so it plays offline.
   Strategy: serve from cache at once, refresh the cache from the network in the background.
   Bump VERSION when shipping changes so old caches are dropped. */
const VERSION = 'last-lantern-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png',
  './icons/icon-maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const key = url.origin + url.pathname; // ?seed=… shares the cached page
  const refresh = fetch(req).then(res => {
    if (res && res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(VERSION).then(c => c.put(key, copy)); }
    return res;
  });
  e.respondWith(caches.match(key).then(hit => hit || refresh.catch(() =>
    req.mode === 'navigate' ? caches.match('./index.html') : Response.error())));
  e.waitUntil(refresh.then(() => {}, () => {}));
});
