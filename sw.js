const CACHE_NAME = 'budgetbee-v1';

// Files to cache for offline use
const STATIC_ASSETS = [
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@300;400;500&family=Lato:wght@300;400;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
];

// ── INSTALL: cache static assets ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url).catch(() => {}))
      );
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE: clean old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH: network first, fallback to cache ──
self.addEventListener('fetch', event => {
  // Skip non-GET and Firebase/Google API requests (always need network)
  if (event.request.method !== 'GET') return;
  const url = event.request.url;
  if (url.includes('firebaseio.com') || url.includes('googleapis.com/google.firestore') || url.includes('identitytoolkit')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses for static assets
        if (response.ok && (url.includes('cdnjs') || url.includes('fonts.googleapis') || url.endsWith('index.html') || url.endsWith('manifest.json'))) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Network failed — return cached version
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Return offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});

// ── BACKGROUND SYNC: notify when back online ──
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
