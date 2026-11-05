import { open, check } from "./harness.mjs";
export default async function () {
  const p = await open({ user: "u1" });
  await p.pick("std:daiquiri"); await p.waitForTimeout(150);
  const line = await p.text(".facts-line");
  check("recipe shows ABV and cost as links under the totals", /~15% ABV/.test(line) && /~\$2\.18 a drink/.test(line), line);
  check("they look like the batch link", (await p.evaluate("[...document.querySelectorAll('.facts-line button')].every(b => b.classList.contains('batch-link'))")));
  await p.click("#abv-open"); await p.waitForTimeout(150);
  const abv = await p.text("#gen-modal");
  check("ABV pop-up: per ingredient, before and after ice, standard drinks", /white rum/i.test(abv) && /80/.test(abv) && /before ice/i.test(abv) && /melted ice \(shaken\)/i.test(abv) && /1\.3 standard drinks/i.test(abv), abv.slice(0, 400));
  await p.evaluate("closeSheet()");
  await p.click("#cost-open"); await p.waitForTimeout(150);
  const cost = await p.text("#gen-modal");
  check("cost pop-up: typical bottle price, per-drink cost, a batch of 12", /\$22 · 750 ml/.test(cost) && /typical/i.test(cost) && /\$2\.18/.test(cost) && /a batch of 12: ~\$26/i.test(cost) && /edit prices/i.test(cost), cost.slice(0, 500));
  await p.evaluate("closeSheet()");
  // your own price replaces the typical one
  await p.evaluate("S.bar.liquors.push({ name: 'White rum', brand: '', out: false, price: 33, size: 750 }); renderMain()"); await p.waitForTimeout(100);
  await p.click("#cost-open"); await p.waitForTimeout(150);
  check("your price replaces the typical one", /\$33 · 750 ml/.test(await p.text("#gen-modal")) && /your price/i.test(await p.text("#gen-modal")), await p.text("#gen-modal"));
  await p.evaluate("closeSheet()");
  // scaling: the cost line turns into the batch
  await p.fill("#servings", "12"); await p.press("#servings", "Tab"); await p.waitForTimeout(150);
  check("at 12 drinks it shows the batch", /~\$\d+ the batch/.test(await p.text(".facts-line")) && /~15% ABV/.test(await p.text(".facts-line")), await p.text(".facts-line"));
  // a mocktail-only recipe: no ABV
  await p.evaluate(`S.drinks.push({ id: "nz", owner: "u2", name: "Nojito", method: "Built", ingredients: [{ amount: 1, unit: "oz", name: "Lime juice" }, { amount: 0.75, unit: "oz", name: "Simple syrup" }, { amount: 4, unit: "oz", name: "Soda water" }] }); selectDrink("nz")`);
  await p.waitForTimeout(150);
  check("no alcohol: no ABV link, cost still shown", !(await p.evaluate("!!document.getElementById('abv-open')")) && await p.isVisible("#cost-open"));
  // price fields in My Bottles
  await p.evaluate("navGo('cart')"); await p.waitForTimeout(200);
  await p.evaluate("editItem('liquors', S.bar.liquors.findIndex(x => (x.name || x) === 'Campari'))"); await p.waitForTimeout(100);
  await p.fill("#bi-price", "$29.99"); await p.selectOption("#bi-size", "1000"); await p.click("#bi-save"); await p.waitForTimeout(100);
  check("bottles can store what you paid", (await p.evaluate("JSON.stringify(barItem(S.bar.liquors.find(x => x.name === 'Campari')))")).includes('"price":29.99,"size":1000'));
  check("no errors", p.errors.length === 0, p.errors.join("; "));
  await p.close();
}
