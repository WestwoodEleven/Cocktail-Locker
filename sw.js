// The Cocktail Locker service worker: lets the site install as an app and open without a connection.
// Pages and code load fresh from the network when online and fall back to the saved copy offline.
// Recipes, sign-in and photos always come from Supabase and are never cached here.
const VERSION = "v5";
const SHELL = [
  "./", "./index.html", "./styles.css", "./config.js", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png",
  "./js/01-core.js",
  "./js/02-data.js",
  "./js/03-list.js",
  "./js/04-detail.js",
  "./js/05-share.js",
  "./js/06-scan.js",
  "./js/07-ratings.js",
  "./js/08-bartender.js",
  "./js/09-locker.js",
  "./js/10-standard.js",
  "./js/11-editor.js",
  "./js/13-match.js",
  "./js/14-party.js",
  "./js/15-swap-makemode.js",
  "./js/16-social.js",
  "./js/17-app.js",
  "./js/18-stock.js",
  "./js/19-bottles.js",
  "./js/20-mocktail.js",
  "./js/99-start.js",
];
const CDN = "https://cdn.jsdelivr.net/";

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // Network first, so updates show up right away; saved copy when offline.
    e.respondWith(fetch(req, { cache: "no-cache" }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("./index.html"))));
  } else if (req.url.startsWith(CDN)) {
    // The Supabase library is versioned, so a saved copy is always correct.
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return res; })));
  }
});
