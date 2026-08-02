// Service worker: app shell + vendored assets offline; data always live.
// ponytail: hand-rolled instead of workbox — 40 lines beats a build plugin.
const CACHE = 'ls-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add('/')).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Live data only — never serve a stale athlete, analysis or upload response.
  if (url.pathname.startsWith('/api/')) return;

  // Navigations: network first, fall back to the cached shell when offline.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put('/', res.clone()));
          return res;
        })
        .catch(() => caches.match('/').then((r) => r || Response.error()))
    );
    return;
  }

  // Assets (hashed JS/CSS, fonts, MediaPipe wasm+model, media, thumbs): cache first.
  // ponytail: no eviction — /media grows with uploads. Add an LRU cap if it bites.
  e.respondWith(
    caches.match(request).then((hit) =>
      hit ||
      fetch(request).then((res) => {
        if (res.ok && res.type === 'basic') caches.open(CACHE).then((c) => c.put(request, res.clone()));
        return res;
      })
    )
  );
});
