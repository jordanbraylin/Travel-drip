const CACHE_NAME = "traveldrip-v230";
const APP_SHELL = [
  "/",
  "/index.html",
  "/login.html",
  "/register.html",
  "/privacy.html",
  "/terms.html",
  "/admin.html",
  "/offline.html",
  "/styles.css?v=124",
  "/navigation.css?v=93",
  "/app.js?v=104",
  "/planner-conversation.js?v=2",
  "/planner-conversation.css?v=2",
  "/photo-feed.js?v=7",
  "/photo-feed.css?v=3",
  "/trip-joy.js?v=2",
  "/trip-joy.css?v=1",
  "/trip-itinerary.js?v=1",
  "/trip-workspaces.js?v=7",
  "/journey-dashboard.js?v=3",
  "/discovery-studio.js?v=4",
  "/discovery-studio.css?v=3",
  "/journey-dashboard.css?v=3",
  "/vendor/lucide.min.js?v=1",
  "/trip-workspaces.css?v=4",
  "/planning-studio.js?v=1",
  "/planning-studio.css?v=2",
  "/icons/planning-coast.jpg",
  "/messaging-contacts.js?v=1",
  "/messaging.css?v=1",
  "/usability.js?v=3",
  "/trip-management.js?v=1",
  "/live-weather.js?v=1",
  "/simple.css?v=6",
  "/vendor/qrcode.js?v=1",
  "/public-config.js?v=3",
  "/manifest.webmanifest",
  "/robots.txt",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/traveldrip-logo-white.svg",
  "/icons/traveldrip-logo-stacked.svg"
];

const isSensitiveRequest = (request) => {
  const url = new URL(request.url);
  return request.method !== "GET"
    || url.pathname.startsWith("/api/")
    || url.pathname.includes("supabase")
    || request.headers.has("authorization");
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin || isSensitiveRequest(request)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match("/index.html")) || cache.match("/offline.html");
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request).then((response) => {
        if (response && response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached || caches.match("/offline.html"));
      return cached || networkFetch;
    })
  );
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Travel-Drip";
  const options = {
    body: data.body || "You have a trip update.",
    icon: "/icons/icon.svg",
    badge: "/icons/icon-192.png",
    data: { url: data.url || "/" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
