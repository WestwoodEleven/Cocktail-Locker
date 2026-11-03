// The Cocktail Locker service worker: lets the site install as an app and open without a connection.
// Pages and code load fresh from the network when online and fall back to the saved copy offline.
// Recipes and photos come from Supabase; the last copies are kept for offline use. Sign-in and private data are never cached.
const VERSION = "v47";
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
  "./js/12-classics.js",
  "./js/13-match.js",
  "./js/14-party.js",
  "./js/15-swap-makemode.js",
  "./js/16-social.js",
  "./js/17-app.js",
  "./js/18-stock.js",
  "./js/19-bottles.js",
  "./js/20-mocktail.js",
  "./js/21-account.js",
  "./js/22-age.js",
  "./js/23-reports.js",
  "./js/24-home.js",
  "./js/25-look.js",
  "./js/26-ask.js",
  "./js/99-start.js",
];
const CDN = "https://cdn.jsdelivr.net/";
// Recipes and drink photos are kept on the device too, so drinks you've seen still open with a bad signal.
// Only public data: drinks, standard recipes, cart names, ratings and bottles (never bars, favorites or lists).
const DATA = "mc-data-1", PHOTOS = "mc-photos-1";
const PUBLIC_TABLES = /\/rest\/v1\/(drinks|standard_recipes|profiles|ratings|bottles|bottle_photos|bottle_reviews)(\?|$)/;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => ![VERSION, DATA, PHOTOS].includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
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
  } else if (/\.supabase\.co$/.test(url.hostname) && PUBLIC_TABLES.test(url.pathname)) {
    // Fresh from the network when online; the last copy when offline.
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(DATA).then(c => c.put(req.url, copy)); }
      return res;
    }).catch(() => caches.open(DATA).then(c => c.match(req.url)).then(r => r || Response.error())));
  } else if (/\.supabase\.co$/.test(url.hostname) && url.pathname.startsWith("/storage/v1/object/public/photos/")) {
    // Photo paths never change once uploaded, so a saved copy is always right.
    e.respondWith(caches.open(PHOTOS).then(c => c.match(req.url).then(r => r || fetch(req).then(res => { if (res.ok || res.type === "opaque") c.put(req.url, res.clone()); return res; }))));
  } else if (req.url.startsWith(CDN)) {
    // The Supabase library is versioned, so a saved copy is always correct.
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return res; })));
  }
});
