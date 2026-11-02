import { open, check } from "./harness.mjs";
import { fileURLToPath } from "node:url";
const fx = n => fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url));
const invoke = `async (name, body) => {
  const n = window.__bottleCalls = (window.__bottleCalls || 0) + 1;
  await new Promise(r => setTimeout(r, 200));
  if (body.mode !== "bottles") return { data: null, error: { name: "FunctionsFetchError" } };
  if (n === 1) return { data: { note: "", bottles: [
    { name: "Bourbon", brand: "Buffalo Trace", category: "liquor", confidence: "high", count: 1 },
    { name: "Campari", brand: "", category: "liqueur", confidence: "medium", count: 1 },
    { name: "Gin", brand: "Tanqueray", category: "liquor", confidence: "high", count: 1 } ] }, error: null };
  return { data: { note: "", bottles: [
    { name: "Bourbon", brand: "Buffalo Trace", category: "liquor", confidence: "high", count: 1 },
    { name: "Angostura bitters", brand: "Angostura", category: "bitters", confidence: "high", count: 1 },
    { name: "Tonic water", brand: "Fever-Tree", category: "mixer", confidence: "low", count: 2 } ] }, error: null };
}`;
export default async function () {
  const p = await open({ invoke });
  check("Stock my bar in Tools", await p.isVisible("#stock-btn"));
  await p.click("#stock-btn"); await p.waitForTimeout(100);
  check("stock page link", (await p.evaluate("location.hash")) === "#stock-bar");
  await p.setInputFiles("#stock-file", [fx("shelf1.jpg"), fx("shelf2.jpg")]);
  await p.waitForTimeout(150);
  check("photos show as reading", (await p.text(".stock-photos")).includes("Reading"));
  await p.waitForTimeout(900);
  check("both photos read", (await p.evaluate("window.__bottleCalls")) === 2 && (await p.text(".stock-photos")).split("found").length === 3, await p.text(".stock-photos"));
  const sent = await p.evaluate("window.__MOCK.lastInvoke");
  check("photo sent as a resized JPEG", sent.mode === "bottles" && sent.mediaType === "image/jpeg" && sent.image.length > 1000);
  const list = await p.text(".stock-list");
  check("duplicate bourbon merged", (await p.evaluate("document.querySelectorAll('.stock-row').length")) === 5 && list.includes("×2"), list);
  const states = await p.evaluate("[...document.querySelectorAll('.stock-row')].map(r => r.querySelector('[data-nm]').value + ':' + r.querySelector('[data-inc]').checked + ':' + (r.querySelector('.stock-meta').textContent.trim()))");
  check("statuses: new, have, brand fill, mixer", states.some(s => s.startsWith("Campari:false") && s.includes("Already in your bar")) && states.some(s => s.startsWith("Gin:true:Adds the brand")) && states.some(s => s.startsWith("Tonic water:true") && s.includes("Guess")), JSON.stringify(states));
  check("button counts what will be added", (await p.text("#stock-add")) === "Add 4 to my bar");
  // fix a misread brand before adding
  const tonic = await p.evaluate("[...document.querySelectorAll('[data-nm]')].find(x => x.value === 'Tonic water').dataset.nm");
  await p.fill(`#bd-${tonic}`, "Fever-Tree Indian"); await p.dispatchEvent(`#bd-${tonic}`, "change");
  await p.click("#stock-add"); await p.waitForTimeout(900);
  const bar = await p.evaluate("window.__MOCK.tables.bars[0].items");
  check("new bottle added with brand", bar.liquors.some(x => x.name === "Bourbon" && x.brand === "Buffalo Trace"), JSON.stringify(bar.liquors));
  check("brand filled on existing Gin", bar.liquors.some(x => x.name === "Gin" && x.brand === "Tanqueray") && bar.liquors.filter(x => (x.name || x) === "Gin").length === 1);
  check("bitters brand filled", bar.bitters.some(x => x.name === "Angostura bitters" && x.brand === "Angostura"));
  check("mixer went to fresh today", await p.evaluate("JSON.parse(localStorage.getItem('mc-fresh')).includes('Tonic water')"));
  check("lands on My cart after adding", (await p.evaluate("location.hash")) === "#my-locker");
  await p.setViewportSize({ width: 390, height: 844 });
  await p.click("#stock-btn"); await p.setInputFiles("#stock-file", [fx("shelf1.jpg")]); await p.waitForTimeout(700);
  check("no sideways scroll on phone", (await p.evaluate("document.documentElement.scrollWidth")) <= 390);
  check("no errors", p.errors.length === 0, p.errors.join("; "));
  await p.close();
}
