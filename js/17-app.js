// The Cocktail Locker: install as an app. Scripts share one global scope and load in numbered order.
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
const standalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
let installEvent = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvent = e; if (!standalone()) $("install-btn").hidden = false; });
$("install-btn").onclick = async () => {
  if (!installEvent) return;
  installEvent.prompt();
  try { const r = await installEvent.userChoice; if (r && r.outcome === "accepted") toast("Installed. Open it from your home screen."); } catch (e) {}
  installEvent = null; $("install-btn").hidden = true;
};
window.addEventListener("appinstalled", () => { $("install-btn").hidden = true; });
// iPhone and iPad Safari have no install prompt, so show a one-time tip instead.
(() => {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  let dismissed = false; try { dismissed = localStorage.getItem("mc-ios-tip") === "1"; } catch (e) {}
  if (ios && !standalone() && !dismissed) $("ios-tip").hidden = false;
  $("ios-tip-x").onclick = () => { $("ios-tip").hidden = true; try { localStorage.setItem("mc-ios-tip", "1"); } catch (e) {} };
})();
