import { open, check } from "./harness.mjs";
import { readFileSync } from "node:fs";
import { stampedHtml } from "../tools/stamp.mjs";
export default async function () {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  check("code version stamps are current (run: node tools/stamp.mjs)", stampedHtml() === html);
  const scripts = [...html.matchAll(/<script src="(js\/[^"?]+)/g)].map(m => m[1]);
  const listed = [...sw.matchAll(/"\.\/(js\/[^"]+)"/g)].map(m => m[1]);
  check("offline copy lists every script", scripts.every(s => listed.includes(s)) && listed.every(s => scripts.includes(s)), JSON.stringify({ scripts, listed }));
  const man = JSON.parse(readFileSync(new URL("../manifest.webmanifest", import.meta.url), "utf8"));
  check("manifest has installable icons", man.icons.some(i => i.sizes === "512x512") && man.icons.some(i => i.sizes === "192x192") && man.display === "standalone");
  const p = await open();
  check("manifest linked", await p.evaluate("!!document.querySelector('link[rel=manifest]')"));
  check("install button hidden until the browser offers it", await p.isHidden("#install-btn"));
  await p.evaluate("const e = new Event('beforeinstallprompt'); e.prompt = () => { window.__prompted = true; }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e);");
  check("install button appears when offered", await p.isVisible("#install-btn"));
  await p.click("#install-btn"); await p.waitForTimeout(50);
  check("install prompt shown on click", await p.evaluate("window.__prompted === true") && await p.isHidden("#install-btn"));
  check("no errors", p.errors.length === 0, p.errors.join("; "));
  await p.close();
}
