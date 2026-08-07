/*
 * Tuveloz service worker.
 *
 * Deliberately conservative. This is a marketplace with signed-in customer,
 * provider, and owner surfaces, so the rule that shapes everything below is:
 * never put a page or an API response in the cache. A cached dashboard is a
 * cached dashboard for whoever picks the phone up next, and a cached API
 * response is a stale price or a stale job status.
 *
 * What it therefore does:
 *   - Hashed build assets  -> cache first. The filename changes when the
 *                             content changes, so a hit is always correct.
 *   - Icons and manifest   -> cache first. Small, stable, versioned by query.
 *   - Page navigations     -> network only, falling back to a static offline
 *                             page. Nothing about the response is stored.
 *   - Everything else      -> untouched; the request goes straight to network.
 *
 * Bump CACHE_VERSION to retire every previously cached file in one deploy.
 */

const CACHE_VERSION = "v1";
const CACHE_NAME = `tuveloz-static-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";

// Small enough to fetch up front, and the offline page is useless if it is not
// already there by the time the network goes away.
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icon-192.png?v=5",
  "/icon-512.png?v=5",
  "/tuveloz-favicon-v2.svg?v=5",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // One bad URL must not fail the whole install and leave the site with no
    // worker at all, so these are added individually.
    await Promise.all(PRECACHE_URLS.map(async (url) => {
      try {
        await cache.add(new Request(url, { cache: "reload" }));
      } catch {
        // A missing optional asset is not worth failing an install over.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith("tuveloz-static-") && key !== CACHE_NAME) {
        await caches.delete(key);
      }
    }
    await self.clients.claim();
  })());
});

/** Hashed build output and versioned brand assets — safe to serve from cache. */
function isCacheableAsset(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/")) return false;
  if (url.pathname.startsWith("/assets/")) return true;
  return /\.(?:css|js|woff2?|png|jpg|jpeg|svg|ico|webmanifest)$/.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Anything that changes state stays entirely out of here.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch {
        // Offline. Serve the static shell rather than a browser error page —
        // and note that the real response was never cached to begin with.
        const cached = await caches.match(OFFLINE_URL);
        return cached ?? new Response(
          "You are offline.",
          { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
        );
      }
    })());
    return;
  }

  if (!isCacheableAsset(url)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      // Opaque and error responses are never worth persisting.
      if (response.ok && response.type === "basic") {
        void cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      if (cached) return cached;
      throw error;
    }
  })());
});

// Lets a future deploy take over immediately instead of waiting for every tab
// to close, and gives us a way to unregister in an emergency.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") void self.skipWaiting();
  if (event.data === "UNREGISTER") {
    void (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith("tuveloz-static-")) await caches.delete(key);
      }
      await self.registration.unregister();
    })();
  }
});
