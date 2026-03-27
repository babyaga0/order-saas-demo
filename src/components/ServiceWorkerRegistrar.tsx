'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(async (reg) => {
          console.log('[SW] Registered, scope:', reg.scope);

          // After SW is ready, proactively cache the current page
          const sw = await navigator.serviceWorker.ready;
          if (sw.active) {
            // Cache the current page URL so it works offline next time
            const cache = await caches.open('mj-pos-v1');
            const currentUrl = window.location.pathname;

            // Cache the current page HTML
            try {
              const response = await fetch(currentUrl);
              if (response.ok) {
                await cache.put(currentUrl, response);
                console.log('[SW] Cached current page:', currentUrl);
              }
            } catch (err) {
              // Already offline or fetch failed - that's fine
            }
          }
        })
        .catch((err) => {
          console.warn('[SW] Registration failed:', err);
        });
    }
  }, []);

  return null;
}
