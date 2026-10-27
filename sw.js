// The app shell service worker (brief section 3). The app's own pages, styles, scripts and icons come from the
// network first, and from this cache when offline, so the app still opens. Firestore, sign-in and the Firebase SDK
// are on other origins and never pass through here, and no app data is kept (Phase 1).
const CACHE = 'the-events-shell-v1';
const SHELL = [
  './', 'index.html', 'signin.html', 'css/tokens.css', 'css/app.css', 'manifest.webmanifest', 'assets/icon.svg',
  'assets/fonts/manrope-latin.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const key = url.origin + url.pathname; // one copy of each file, whatever its ?id=
  event.respondWith(fetch(event.request)
    .then((response) => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then((cache) => cache.put(key, copy)));
      }
      return response;
    })
    .catch(() => caches.match(key).then((hit) => hit || Response.error())));
});
