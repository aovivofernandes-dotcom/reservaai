const VERSION = 'v3';
const SHELL_CACHE = `reservaai-shell-${VERSION}`;
const ASSET_CACHE = `reservaai-assets-${VERSION}`;
const ALL_CACHES = [SHELL_CACHE, ASSET_CACHE];

const APP_SHELL = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/favicon.svg',
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        cache.addAll(APP_SHELL).catch(() => {
          // Pre-cache best-effort — don't fail install if a shell resource is missing
        }),
      )
      .then(() => self.skipWaiting()),
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !ALL_CACHES.includes(k))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Never intercept API calls — always go to network
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Navigation requests (HTML / SPA routes): network-first → shell fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            caches.open(SHELL_CACHE).then((c) => c.put('/', res.clone()));
          }
          return res;
        })
        .catch(() =>
          caches
            .match('/')
            .then((r) => r || new Response('Offline — abra quando houver conexão.', { status: 503 })),
        ),
    );
    return;
  }

  // Static assets (JS, CSS, images, fonts, icons): stale-while-revalidate
  const isStaticAsset =
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname === '/favicon.svg' ||
    url.pathname === '/manifest.json';

  if (isStaticAsset) {
    event.respondWith(
      caches.open(ASSET_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const networkFetch = fetch(request)
            .then((res) => {
              if (res.ok) cache.put(request, res.clone());
              return res;
            })
            .catch(() => cached);
          // Return cached immediately and refresh in background
          return cached || networkFetch;
        }),
      ),
    );
  }
});
