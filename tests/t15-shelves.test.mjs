import { open, check, sample } from "./harness.mjs";
export default async function () {
  const t = sample();
  t.bars = [{ user_id: "u1", items: { liquors: [
    "Gin", "Campari", "Sweet vermouth", { name: "Bourbon", brand: "Buffalo Trace", out: false }, "Rye whiskey", { name: "Blanco tequila", out: true },
    "Mezcal", { name: "Triple sec", brand: "Cointreau" }, "Dark rum", { name: "Mystery bottle", brand: "Grandpa's" }], syrups: ["Simple syrup", "Honey syrup"], bitters: [] } }];
  const p = await open({ tables: t, width: 390 });
  await p.evaluate("$('locker-btn').click(); openCartSec('bottles')"); await p.waitForTimeout(200);
  const shelves = await p.evaluate("[...document.querySelectorAll('#chips-liquors .shelf')].map(s => s.querySelector('.shelf-name').firstChild.textContent.trim() + ': ' + [...s.querySelectorAll('.chip-main')].map(c => c.firstChild.textContent.trim()).join(', '))");
  const want = ["Whiskey: Bourbon, Rye whiskey", "Gin: Gin", "Rum: Dark rum", "Tequila & mezcal: Mezcal, Blanco tequila", "Liqueurs: Campari, Triple sec", "Vermouth & wine: Sweet vermouth", "Other: Mystery bottle"];
  check("liquors grouped into shelves in a set order", JSON.stringify(shelves) === JSON.stringify(want), JSON.stringify(shelves));
  check("out of stock sorted last on its shelf", shelves[3].endsWith("Blanco tequila"));
  check("shelf counts shown", /whiskey\s*\|?\s*2/i.test(await p.text("#chips-liquors")));
  const before = await p.evaluate("JSON.stringify(window.__MOCK.tables.bars[0].items.liquors)");
  await p.evaluate("document.querySelector('#chips-liquors .chip-main[data-edit=\"4\"]').parentElement.querySelector('[data-out]').click()"); await p.waitForTimeout(900);
  const after = await p.evaluate("window.__MOCK.tables.bars[0].items.liquors");
  check("buttons still act on the right bottle", after[4].name === "Rye whiskey" && after[4].out === true && after.filter(x => x.out).length === 2, JSON.stringify(after));
  check("syrups stay a simple A–Z row", (await p.evaluate("document.querySelectorAll('#chips-syrups .shelf').length")) === 0 && (await p.text("#chips-syrups")).indexOf("Honey") < (await p.text("#chips-syrups")).indexOf("Simple"));
  check("no sideways scroll on phone", (await p.evaluate("document.documentElement.scrollWidth")) <= 390);
  check("no errors", p.errors.length === 0, p.errors.join("; "));
  await p.close();
}
