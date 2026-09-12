// Hand-written service worker for PDFChef.
// Caches the app shell and serves assets offline. No build plugin,
// no dependencies -- just standard service worker APIs.

const CACHE = 'pdfchef-v1';
const CORE = ['/', '/index.html', '/icon.svg', '/manifest.webmanifest'];

// Beim Installieren die App-Schale vorab cachen und sofort aktivieren.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(CORE).catch((error) => {
          // Einzelne fehlende Kern-Dateien sollen die Installation nicht blockieren.
          console.warn('SW: Vorab-Caching der App-Schale teilweise fehlgeschlagen', error);
        }),
      )
      .then(() => self.skipWaiting()),
  );
});

// Beim Aktivieren alte Cache-Versionen entfernen und Kontrolle uebernehmen.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Nur same-origin GET-Requests behandeln, alles andere unveraendert durchreichen.
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Navigationen (SPA-Seiten): network-first, offline zurueck auf index.html.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html').then((cached) => cached || Response.error())),
    );
    return;
  }

  // Uebrige same-origin Assets: stale-while-revalidate.
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.status === 200 && response.type === 'basic') {
              cache.put(request, response.clone()).catch(() => {
                // Cache-Schreibfehler (z. B. voller Speicher) ignorieren.
              });
            }
            return response;
          })
          .catch(() => cached);

        return cached || networkFetch;
      }),
    ),
  );
});
