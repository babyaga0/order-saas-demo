// Mieux Jeans POS - Service Worker for Offline Support
const CACHE_NAME = 'mj-pos-v3';

// Install: Activate immediately
self.addEventListener('install', (event) => {
  console.log('[SW] Installing v3');
  self.skipWaiting();
});

// Activate: Clean old caches, take control immediately
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating v3');
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Cache everything from our origin
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests (POST sales, etc.)
  if (event.request.method !== 'GET') return;

  // Skip external origins (API calls to Railway backend, etc.)
  if (url.origin !== self.location.origin) return;

  // Skip API proxy calls
  if (url.pathname.startsWith('/api')) return;

  // For everything else (pages, JS, CSS, images): Network first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache valid responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // Offline: serve from cache
        return caches.match(event.request).then((cached) => {
          if (cached) {
            console.log('[SW] Serving from cache:', url.pathname);
            return cached;
          }
          // If a POS page isn't cached, try serving any cached POS page
          if (url.pathname.startsWith('/pos')) {
            return caches.match('/pos').then((fallback) => {
              if (fallback) return fallback;
              // Last resort: offline message
              return new Response(
                '<html><body style="font-family:sans-serif;text-align:center;padding:50px"><h1>Hors ligne</h1><p>Rechargez quand internet revient</p></body></html>',
                { headers: { 'Content-Type': 'text/html' } }
              );
            });
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});
