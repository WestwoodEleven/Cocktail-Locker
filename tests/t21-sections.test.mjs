import { open, check, sample } from "./harness.mjs";
const ids = p => p.evaluate("[...document.querySelectorAll('#list button[data-id]')].map(b => b.dataset.id)");
const heads = p => p.evaluate("[...document.querySelectorAll('#list .sec-head-row h3')].map(h => h.textContent)");
export default async function () {
  const t = sample();
  t.drink_views = [{ drink_id: "pk", day: "2026-11-01", views: 9 }, { drink_id: "mule", day: "2026-11-02", views: 4 }, { drink_id: "std:daiquiri", day: "2026-11-02", views: 2 }];
  for (let i = 0; i < 14; i++) t.drinks.push({ id: "x" + i, owner: "u1", name: "Mine " + i, data: { name: "Mine " + i, method: "Shaken", ingredients: [{ amount: 1, unit: "oz", name: "Gin" }] } });
  const p = await open({ user: "u1", tables: t, home: true });
  check("Drinks shows the four sections in order", JSON.stringify(await heads(p)) === JSON.stringify(["My Drinks", "Trending", "Highest Rated", "The Classics"]), JSON.stringify(await heads(p)));
  const first = await ids(p);
  check("each section starts at 5", first.filter(x => /^x|rita|neg-1/.test(x)).length >= 5 && (await p.evaluate("[...document.querySelectorAll('#sec-mine ~ li')].indexOf(document.querySelector('#sec-trending'))")) === 6);
  check("trending is ordered by views", first.indexOf("pk") < first.indexOf("mule"));
  await p.click("[data-sec-more='mine']"); await p.waitForTimeout(100);
  check("Show more adds 5", (await p.evaluate("[...document.querySelectorAll('#sec-mine ~ li')].indexOf(document.querySelector('#sec-trending'))")) === 11);
  await p.click("[data-sec-more='mine']"); await p.waitForTimeout(100);
  check("then See all", await p.isVisible("[data-sec-all='mine']"));
  await p.click("[data-sec-all='mine']"); await p.waitForTimeout(150);
  check("See all shows every one of your drinks", (await heads(p)).length === 0 && (await p.evaluate("S.f.owner")) === "mine");
  await p.click(".fchip[data-fv='mine']"); await p.waitForTimeout(150);
  check("clearing the filter brings the sections back", (await heads(p)).length === 4);
  await p.fill("#search", "negroni"); await p.waitForTimeout(150);
  check("searching shows one plain list", (await heads(p)).length === 0 && (await ids(p)).includes("neg-1"));
  await p.fill("#search", ""); await p.waitForTimeout(150);
  await p.click("[data-sec-browse]"); await p.waitForTimeout(150);
  check("Browse all lists every drink", (await ids(p)).length === (await p.evaluate("allDrinks().length")) && await p.isVisible("[data-sec-back]"));
  await p.click("[data-sec-back]"); await p.waitForTimeout(100);
  check("and back to sections", (await heads(p)).length === 4);
  // views: someone else's drink counts once; your own never
  await p.click("#list button[data-id='pk']"); await p.waitForTimeout(150);
  await p.evaluate("renderMain()"); await p.goBack(); await p.waitForTimeout(150);
  await p.click("#list button[data-id='pk']"); await p.waitForTimeout(150);
  await p.evaluate("selectDrink('rita')"); await p.waitForTimeout(100);
  check("opening a drink counts one view, once per visit, not your own", JSON.stringify(await p.evaluate("window.__MOCK.viewCalls")) === JSON.stringify(["pk"]), JSON.stringify(await p.evaluate("window.__MOCK.viewCalls")));
  check("no errors", p.errors.length === 0, p.errors.join("; "));
  await p.close();
  // signed out, no views yet: Recently Added, no My Drinks
  const p2 = await open({ user: null, home: true });
  const h2 = await heads(p2);
  check("signed out: no My Drinks; without views, Recently Added or nothing", !h2.includes("My Drinks") && h2.includes("Highest Rated") && h2.includes("The Classics"), JSON.stringify(h2));
  await p2.close();
}
