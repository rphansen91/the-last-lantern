/* Gloamglass — offline cache. Bump VERSION on ship.
   Network-first for the page, code and data (always fresh when online, cached copy offline); cache-first for images. */
const VERSION = 'gloamglass-v3';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './screenshots/cover.png'
];
self.addEventListener('install', e => {
  // cache:'reload' bypasses the HTTP cache so a new version never precaches stale files
  e.waitUntil(caches.open(VERSION)
    .then(c => Promise.all(SHELL.map(u => fetch(new Request(u, { cache: 'reload' }))
      .then(r => r.ok ? c.put(new URL(u, self.location).href.split('?')[0], r) : null).catch(() => null))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('gloamglass-') && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
function isFreshFirst(req, url) {
  return req.mode === 'navigate' || /\.(html|css|js|json|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');
}
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const key = url.origin + url.pathname;
  const save = res => {
    if (res && res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(VERSION).then(c => c.put(key, copy)); }
    return res;
  };
  if (isFreshFirst(req, url)) {
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(save).catch(() =>
      caches.match(key).then(hit => hit || (req.mode === 'navigate' ? caches.match(new URL('./index.html', self.location).href) : Response.error()))));
    return;
  }
  e.respondWith(caches.match(key).then(hit => hit || fetch(req).then(save)));
});
