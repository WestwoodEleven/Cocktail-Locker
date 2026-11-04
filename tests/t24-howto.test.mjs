import { open, check } from "./harness.mjs";
import { CLASSICS } from "../tools/classics-data.mjs";
export default async function () {
  const p = await open({});
  const specs = CLASSICS.map(c => ({ name: c[0], method: c[3], garnish: c[5], ingredients: c[6].map(([amount, unit, name]) => ({ amount, unit, name })) }));
  const got = Object.fromEntries(await p.evaluate(s => s.map(d => [d.name, howtosFor(d).map(h => h.key)]), specs));
  const has = (n, ...keys) => keys.every(k => got[n].includes(k));
  check("the How to row is techniques only", has("Pisco Sour", "shake", "dry-shake") && !got["Pisco Sour"].includes("simple") && !got["Pisco Sour"].includes("citrus"), JSON.stringify(got["Pisco Sour"]));
  check("Mojito: muddle; Sazerac: rinse, stir; Mai Tai: no double strain", has("Mojito", "muddle") && has("Sazerac", "rinse", "stir") && !got["Mai Tai"].includes("double-strain"));
  // which guide each ingredient name opens
  const ing = await p.evaluate(`[
    "Simple syrup", "1:1 simple syrup", "2:1 simple syrup", "Rich simple syrup", "Rich demerara syrup", "Demerara rum", "3:1 honey syrup", "Honey-ginger syrup",
    "Blanco tequila", "Agave syrup", "Lime juice", "Fresh lemon juice", "Orgeat", "Gin", "Bourbon", "Honey liqueur"
  ].map(n => { const h = ingHowto(n); return h ? h.key + (h.ratio ? ":" + h.ratio.join("/") : "") : "-"; })`);
  check("ingredient names find the right guide and ratio", JSON.stringify(ing) === JSON.stringify(["simple", "simple:1/1", "rich:2/1", "rich:2/1", "demerara:2/1", "-", "honey:3/1", "honey-ginger", "-", "agave", "citrus", "citrus", "orgeat", "-", "-", "-"]), JSON.stringify(ing));
  // on the page: the Daiquiri (classic) has Lime juice and Simple syrup linked
  await p.pick("std:daiquiri"); await p.waitForTimeout(150);
  check("syrups and citrus are tappable in the spec", (await p.evaluate("[...document.querySelectorAll('.spec-table .ing-link')].map(b => b.dataset.howto).join()")) === "citrus,simple");
  await p.click(".spec-table .ing-link[data-howto='simple']"); await p.waitForTimeout(150);
  const one = await p.text("#gen-modal");
  check("one drink: how much it uses and what a small batch makes", /one drink uses ¾ oz/i.test(one) && /½ cup sugar and ½ cup hot water makes about 6 oz, enough for 8 drinks/i.test(one), one);
  await p.keyboard.press("Escape"); await p.evaluate("closeSheet && closeSheet()");
  await p.fill("#servings", "12"); await p.press("#servings", "Tab"); await p.waitForTimeout(150);
  await p.click(".spec-table .ing-link[data-howto='simple']"); await p.waitForTimeout(150);
  const batch = await p.text("#gen-modal");
  check("a batch: how much it needs and how much to make", /this batch needs 9 oz/i.test(batch) && /1 cup sugar and 1 cup hot water makes about 12 oz/i.test(batch), batch);
  await p.evaluate("closeSheet && closeSheet()");
  await p.click(".spec-table .ing-link[data-howto='citrus']"); await p.waitForTimeout(150);
  check("citrus: how many limes", /12 oz of lime juice: about 12 limes/i.test(await p.text("#gen-modal")), await p.text("#gen-modal"));
  await p.evaluate("closeSheet && closeSheet()");
  // a 3:1 honey syrup opens the honey guide at that ratio
  await p.evaluate(`S.drinks.push({ id: "hr", owner: "u2", name: "Honey Test", method: "Shaken", ingredients: [{ amount: 0.5, unit: "oz", name: "3:1 honey syrup" }, { amount: 2, unit: "oz", name: "Gin" }] }); selectDrink("hr")`);
  await p.waitForTimeout(150);
  await p.click(".spec-table .ing-link"); await p.waitForTimeout(150);
  const hon = await p.text("#gen-modal");
  check("ratio in the name changes the guide", /honey syrup \(3:1\)/i.test(hon) && /stir 3 parts honey into 1 part hot water/i.test(hon) && /¾ cup honey and ¼ cup hot water/i.test(hon), hon);
  check("store-bought note leads for orgeat", await p.evaluate("HOWTO.find(h => h.key === 'orgeat').buy.startsWith('Most people buy it')"));
  check("no errors", p.errors.length === 0, p.errors.join("; "));
  await p.close();
}
