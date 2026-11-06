import { open, check, sample } from "./harness.mjs";
import { fileURLToPath } from "node:url";
const fx = n => fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url));
const invoke = `async (name, body) => {
  if (body.mode !== "photo_check") return { data: null, error: { name: "FunctionsFetchError" } };
  window.__checks = (window.__checks || []).concat(body.kind + ":" + body.name);
  return { data: window.__verdict || { verdict: "ok" }, error: null };
}`;
export default async function () {
  const p = await open({ user: "u1", invoke });
  // a photo that passes goes up as usual
  await p.pick("rita"); await p.waitForTimeout(100);
  await p.setInputFiles("#photo-file", fx("shelf1.jpg")); await p.waitForTimeout(800);
  check("photos are checked with the drink's name", JSON.stringify(await p.evaluate("window.__checks")) === JSON.stringify(["drink:Mitch-A-Rita"]));
  const ritaPhoto = await p.evaluate("window.__MOCK.tables.drinks.find(d => d.id === 'rita').data.photo");
  check("an ok photo shows right away", !!ritaPhoto && (await p.evaluate("window.__MOCK.tables.photo_reviews || []")).length === 0);
  // a questionable one is held
  await p.evaluate("window.__verdict = { verdict: 'hold', reason: 'A selfie, not a drink.' }");
  await p.setInputFiles("#photo-file", fx("shelf2.jpg")); await p.waitForTimeout(800);
  const held = await p.evaluate("window.__MOCK.tables.photo_reviews || []");
  check("a held photo waits for review and the old photo stays", held.length === 1 && held[0].kind === "drink" && held[0].target === "rita" && held[0].reason === "A selfie, not a drink." && held[0].path.startsWith("u1/")
    && (await p.evaluate("window.__MOCK.tables.drinks.find(d => d.id === 'rita').data.photo")) === ritaPhoto, JSON.stringify(held));
  check("the owner sees it's waiting", /waiting for a quick review/i.test(await p.text("#main")));
  // bottle photos too
  await p.evaluate("openBottle('Cointreau')"); await p.waitForTimeout(400);
  await p.setInputFiles("#bottle-file", fx("shelf1.jpg")); await p.waitForTimeout(800);
  check("held bottle photos aren't published", (await p.evaluate("(window.__MOCK.tables.bottle_photos || []).length")) === 0 && (await p.evaluate("window.__MOCK.tables.photo_reviews.length")) === 2);
  check("no errors", p.errors.length === 0, p.errors.join("; "));
  const tables = await p.evaluate("window.__MOCK.tables");
  await p.close();

  // an admin approves the drink photo and rejects the bottle photo
  tables.site_admins = [{ user_id: "u2" }];
  tables.drinks = tables.drinks.map(d => ({ id: d.id, owner: d.owner, name: d.data.name, data: d.data }));
  const a = await open({ user: "u2", tables });
  await a.evaluate("navGo('cart')"); await a.waitForTimeout(300);
  check("admins see Review photos with a count", /review photos 2/i.test(await a.text("#prof-photos")), await a.text("#prof-photos"));
  await a.click("#prof-photos"); await a.waitForTimeout(300);
  check("the review page shows each photo and the reason", (await a.evaluate("document.querySelectorAll('.pr-item').length")) === 2 && /a selfie, not a drink/i.test(await a.text("#main")));
  const ids = await a.evaluate("S.held.map(h => h.kind + ':' + h.id)");
  await a.click(`[data-pr-ok='${ids.find(x => x.startsWith("drink")).split(":")[1]}']`); await a.waitForTimeout(300);
  const rita = await a.evaluate("window.__MOCK.tables.drinks.find(d => d.id === 'rita').data");
  check("approving sets the drink's photo", rita.photo === held[0].path && rita.name === "Mitch-A-Rita");
  await a.click(`[data-pr-no='${ids.find(x => x.startsWith("bottle")).split(":")[1]}']`); await a.waitForTimeout(300);
  check("rejecting removes it; nothing left to review", (await a.evaluate("window.__MOCK.tables.photo_reviews.length")) === 0 && (await a.evaluate("window.__MOCK.tables.bottle_photos.length")) === 0 && /nothing waiting/i.test(await a.text("#main")));
  check("admin: no errors", a.errors.length === 0, a.errors.join("; "));
  await a.close();
}
