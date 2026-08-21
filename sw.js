/* Minimal service worker: network-first so updates always show during active
   development; falls back to a cached app shell only when offline. */
const CACHE = 'alongside-v1';
const SHELL = ['/', '/index.html', '/styles.css', '/app.css', '/app.js', '/i18n.js', '/assets/icon.svg'];

self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(()=>{})); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;         // never cache API/auth POSTs or cross-origin
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return; // always live
  e.respondWith(
    fetch(e.request).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; })
      .catch(() => caches.match(e.request).then(m => m || caches.match('/index.html')))
  );
});
