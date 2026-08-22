'use strict';

const CACHE_NAME = 'axm-pong-cross-controller-v4';
const SHELL_KEY = new URL('./controller-shell', self.registration.scope).href;
const STATIC_ASSETS = [
  './controller-shell',
  './manifest.webmanifest',
  './controller-icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => /axm-(?:robo-)?pong-cross-controller-/.test(key) && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (!response.ok) throw new Error('controller runtime unavailable');
          caches.open(CACHE_NAME).then(cache => cache.put(SHELL_KEY, response.clone()));
          return response;
        })
        .catch(() => caches.match(SHELL_KEY))
    );
    return;
  }

  if (/\/(?:manifest\.webmanifest|controller-icon\.svg)$/.test(url.pathname)) {
    event.respondWith(caches.match(request).then(hit => hit || fetch(request)));
  }
});
