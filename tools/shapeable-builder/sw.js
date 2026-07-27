"use strict";

const CACHE_NAME = "axm-shapeable-builder-beta-v0.13.1";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./model.js",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/axm-builder-mark.svg"
];

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function (cache) {
    return cache.addAll(SHELL);
  }).then(function () {
    return self.skipWaiting();
  }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) {
      return key.startsWith("axm-shapeable-builder-") && key !== CACHE_NAME;
    }).map(function (key) {
      return caches.delete(key);
    }));
  }).then(function () {
    return self.clients.claim();
  }));
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then(function (cached) {
    if (cached) return cached;
    return fetch(event.request).then(function (response) {
      if (!response || response.status !== 200 || response.type === "opaque") return response;
      const copy = response.clone();
      caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
      return response;
    }).catch(function () {
      if (event.request.mode === "navigate") return caches.match("./index.html");
      throw new Error("Resource is unavailable offline and was not previously cached.");
    });
  }));
});
