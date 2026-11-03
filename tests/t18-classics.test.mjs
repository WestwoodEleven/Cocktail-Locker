import { open, check } from "./harness.mjs";
export default async function () {
  const p = await open({});
  const det = await p.evaluate(`[
    detectClassic({ ingredients: [{ name: "Tequila blanco" }, { name: "Fresh lime juice" }, { name: "Orange liqueur", brand: "Cointreau" }] }),
    detectClassic({ ingredients: [{ name: "Reposado tequila" }, { name: "Lime juice" }, { name: "Agave syrup" }] }),
    detectClassic({ ingredients: [{ name: "Bourbon" }, { name: "Aperol" }, { name: "Amaro Nonino" }, { name: "Lemon juice" }] }),
    detectClassic({ ingredients: [{ name: "White rum" }, { name: "Lime juice" }, { name: "Simple syrup" }] }),
    detectClassic({ ingredients: [{ name: "White rum" }, { name: "Lime juice" }, { name: "Simple syrup" }, { name: "Mint" }, { name: "Soda water" }] }),
    detectClassic({ ingredients: [{ name: "Amber rum" }, { name: "Orgeat" }, { name: "Orange liqueur" }, { name: "Lime juice" }] }),
    detectClassic({ ingredients: [{ name: "Rye" }, { name: "Sweet vermouth" }, { name: "Angostura bitters" }] }),
    detectClassic({ ingredients: [{ name: "Gin" }, { name: "Pineapple juice" }] })
  ]`);
  check("recognizes classics from their ingredients", JSON.stringify(det) === JSON.stringify(["Margarita", "Tommy's Margarita", "Paper Plane", "Daiquiri", "Mojito", "Mai Tai", "Manhattan", ""]), JSON.stringify(det));
  await p.fill("#search", "margarita"); await p.waitForTimeout(150);
  const ids = await p.evaluate("[...document.querySelectorAll('#list button[data-id]')].map(b => b.dataset.id)");
  check("searching margarita finds the Mitch-A-Rita", ids.includes("rita"), JSON.stringify(ids));
  check("the list says it's a riff", /riff on a margarita/i.test(await p.text("#list")));
  await p.fill("#search", ""); await p.waitForTimeout(100);
  await p.pick("rita"); await p.waitForTimeout(100);
  check("the recipe says it's a riff on the Margarita", /a riff on the margarita/i.test(await p.text("#main")));
  await p.pick("neg-1"); await p.waitForTimeout(100);
  check("a drink named for its classic doesn't say riff", !/a riff on/i.test(await p.text("#main")));
  // the owner can set it or turn it off
  await p.pick("rita"); await p.act("edit-btn"); await p.waitForTimeout(100);
  check("editor shows the recognized classic", /auto: margarita/i.test(await p.text("#f-classic-auto")));
  await p.selectOption("#f-classic", "none"); await p.click("#save-btn"); await p.waitForTimeout(200);
  check("Not a riff turns it off", !/a riff on/i.test(await p.text("#main")) && (await p.evaluate("window.__MOCK.tables.drinks.find(d => d.id === 'rita').data.classic")) === "none");
  await p.act("edit-btn"); await p.waitForTimeout(100);
  await p.selectOption("#f-classic", "Paloma"); await p.click("#save-btn"); await p.waitForTimeout(200);
  check("owner can choose a different classic", /a riff on the paloma/i.test(await p.text("#main")));
  await p.fill("#search", "paloma"); await p.waitForTimeout(150);
  check("and search follows it", (await p.evaluate("[...document.querySelectorAll('#list button[data-id]')].map(b => b.dataset.id)")).includes("rita"));
  check("no errors", p.errors.length === 0, p.errors.join("; "));
  await p.close();
}
