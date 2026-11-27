// @ts-check
/**
 * @file Service worker — cache-first strategy for the app shell.
 * Provides full offline capability as a privacy guarantee.
 */

const CACHE_NAME = 'redactlocal-v1';

const APP_SHELL = [
  './',
  './index.html',
  './favicon.svg',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/constants.js',
  './js/engine.js',
  './js/worker.js',
  './js/ai-assist.js',
  './js/detectors.js',
  './js/validators.js',
  './js/redactor.js',
  './js/csv.js',
  './js/diff.js',
  './js/fileio.js',
  './js/samples.js',
];

self.addEventListener('install', (event) => {
  /** @type {ExtendableEvent} */ (event).waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  /** @type {any} */ (self).skipWaiting();
});

self.addEventListener('activate', (event) => {
  /** @type {ExtendableEvent} */ (event).waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  /** @type {any} */ (self).clients.claim();
});

self.addEventListener('fetch', (event) => {
  const fetchEvent = /** @type {FetchEvent} */ (event);
  const url = new URL(fetchEvent.request.url);

  // Only handle same-origin GET requests
  if (url.origin !== self.location.origin) return;
  if (fetchEvent.request.method !== 'GET') return;

  fetchEvent.respondWith(
    caches.match(fetchEvent.request).then((cached) => {
      return cached || fetch(fetchEvent.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(fetchEvent.request, clone));
        return response;
      });
    })
  );
});
