import { open, check } from "./harness.mjs";
import { fileURLToPath } from "node:url";
const fx = n => fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url));
const invoke = `async (name, body) => {
  if (body.mode !== "menu") return { data: null, error: { name: "FunctionsFetchError" } };
  window.__menuCalls = (window.__menuCalls || 0) + 1;
  await new Promise(r => setTimeout(r, 150));
  return { data: { bar: window.__menuCalls > 1 ? "Second Bar" : "Bar Agricole", drinks: [
    { name: "Cane & Cinnamon", menu_text: "aged rum, cinnamon-honey, lime", price: "$16", classic: "Daiquiri", riff: "Aged rum with a cinnamon-honey syrup", type: "Sour", base: "Rum", method: "Shaken", glass: "Coupe", garnish: "Lime wheel",
      ingredients: [{ amount: 2, unit: "oz", name: "Aged rum" }, { amount: 0.75, unit: "oz", name: "Lime juice" }, { amount: 0.75, unit: "oz", name: "Cinnamon-honey syrup", house: true }],
      steps: ["Shake hard with ice.", "Double strain into a chilled coupe."],
      house_made: [{ name: "Cinnamon-honey syrup", ingredients: ["½ cup honey", "½ cup water", "2 cinnamon sticks"], steps: ["Simmer 5 minutes.", "Steep 1 hour, then strain."], keeps: "About 2 weeks in the fridge", shortcut: "Honey syrup with a pinch of cinnamon" }],
      confidence: "high", note: "" },
    { name: "Bitter Garden", menu_text: "gin, campari, cucumber", price: "$15", classic: "Negroni", riff: "", type: "Spirit-forward", base: "Gin", method: "Stirred", glass: "Rocks", garnish: "",
      ingredients: [{ amount: 1, unit: "oz", name: "Gin" }, { amount: 1, unit: "oz", name: "Campari" }, { amount: 1, unit: "oz", name: "Sweet vermouth" }],
      steps: ["Stir with ice.", "Strain over a big cube."], house_made: [], confidence: "medium", note: "" } ] }, error: null };
}`;
export default async function () {
  const p = await open({ user: "u1", invoke, width: 390 });
  await p.evaluate("localStorage.removeItem('mc-menu'); S.menuRes = null; openMenuDecoder()"); await p.waitForTimeout(150);
  await p.click("#md-pick"); await p.setInputFiles("#menu-file", fx("shelf1.jpg")); await p.waitForTimeout(700);
  check("a decoded menu is saved to your account", (await p.evaluate("__MOCK.tables.menus?.length")) === 1 && !!(await p.evaluate("S.menuRes.id")), await p.evaluate("JSON.stringify(__MOCK.tables.menus)"));
  check("the menu page shows the bar, Rename and Delete", /Bar Agricole/.test(await p.text(".md-bar")) && await p.isVisible("#md-rename") && await p.isVisible("#md-delete"));
  // share a decoded drink: the regular recipe card, no link to a page that doesn't exist
  await p.click('[data-md-open="0"]'); await p.waitForTimeout(150);
  check("Save, Share and + List sit on the decoded drink", /Save/.test(await p.text("#md-save")) && await p.isVisible("#md-share"));
  await p.click("#md-share"); await p.waitForTimeout(1500);
  check("Share makes the recipe card, credited to the bar's menu", !(await p.evaluate("$('share-modal').hidden")) && (await p.evaluate("shareState && shareState.d.fromMenu")) === "From Bar Agricole's menu" && (await p.evaluate("$('share-link').hidden")));
  await p.evaluate("closeShare()");
  check("the card notes carry the house-made syrup", /Cinnamon-honey syrup: ½ cup honey, ½ cup water, 2 cinnamon sticks\. Simmer 5 minutes\./.test(await p.evaluate("menuToDrink(S.menuRes.drinks[0]).cardNotes")));
  // a second menu: both listed, switch between them
  await p.click("#md-back"); await p.waitForTimeout(150);
  await p.click("#md-pick"); await p.setInputFiles("#menu-file", fx("shelf1.jpg")); await p.waitForTimeout(700);
  check("the newest menu opens; the other is under My menus", /Second Bar/.test(await p.text(".md-bar")) && /Bar Agricole/.test(await p.text(".md-menus")) && /My menus 2/.test(await p.text("#main")), await p.text("#main"));
  await p.click(".md-menus [data-md-menu]"); await p.waitForTimeout(150);
  check("tapping a saved menu opens it", /Bar Agricole/.test(await p.text(".md-bar")));
  // rename
  await p.click("#md-rename"); await p.waitForTimeout(100); await p.fill("#mn-name", "Bar Agricole, SF"); await p.press("#mn-name", "Enter"); await p.waitForTimeout(150);
  check("rename saves to the account", /Bar Agricole, SF/.test(await p.text(".md-bar")) && (await p.evaluate("__MOCK.tables.menus.some(x => x.bar === 'Bar Agricole, SF')")));
  // delete
  await p.click("#md-delete"); await p.waitForTimeout(100); await p.click("#mn-del"); await p.waitForTimeout(150);
  check("delete removes it and opens the next menu", (await p.evaluate("__MOCK.tables.menus.length")) === 1 && /Second Bar/.test(await p.text(".md-bar")));
  // loading from the account on another device
  await p.evaluate("localStorage.removeItem('mc-menu'); S.menuRes = null; S.menus = []; loadMenus().then(() => openMenuDecoder())"); await p.waitForTimeout(200);
  check("with nothing open, My menus lists your saved menus", /Second Bar/.test(await p.text(".md-menus")) && /photograph a menu/i.test(await p.text("#md-pick")));
  // My Cocktail Cart: My decoded menus, sorted by name, unnamed last with a way to name them
  await p.evaluate(`__MOCK.tables.menus.push({ id: 901, user_id: "u1", bar: "The Varnish", drinks: [{ name: "A", ingredients: [] }], created_at: "2026-10-01T00:00:00Z" }, { id: 902, user_id: "u1", bar: null, drinks: [{ name: "B", ingredients: [] }], created_at: "2026-10-02T00:00:00Z" }, { id: 903, user_id: "u1", bar: "Anvil", drinks: [{ name: "C", ingredients: [] }], created_at: "2026-10-03T00:00:00Z" }); loadMenus().then(() => navGo('cart'))`);
  await p.waitForTimeout(250);
  const names = await p.evaluate("[...document.querySelectorAll('#prof-menus .md-row b')].map(b => b.textContent)");
  check("the cart page lists decoded menus by restaurant name", JSON.stringify(names) === JSON.stringify(["Anvil", "Second Bar", "The Varnish", "Unnamed menu"]), JSON.stringify(names));
  await p.click('#prof-menus [data-md-name="902"]'); await p.waitForTimeout(100);
  await p.fill("#mn-name", "Bar Lucia"); await p.press("#mn-name", "Enter"); await p.waitForTimeout(150);
  check("you can name a menu the photo didn't name", (await p.evaluate("[...document.querySelectorAll('#prof-menus .md-row b')].map(b => b.textContent).join()")) === "Anvil,Bar Lucia,Second Bar,The Varnish");
  await p.click('#prof-menus [data-md-menu="901"]'); await p.waitForTimeout(200);
  check("tapping one opens the full menu", (await p.evaluate("S.view")) === "menu" && /The Varnish/.test(await p.text(".md-bar")) && (await p.evaluate("document.querySelectorAll('[data-md-open]').length")) === 1);
  // a fresh decode without a bar name asks for it
  await p.evaluate("setMenuRes(Object.assign({}, S.menus.find(x => x.id === 903), { bar: '' })); S.menus.find(x => x.id === 903).bar = ''; renderMain()"); await p.waitForTimeout(100);
  await p.fill("#md-name-in", "Anvil Bar & Refuge"); await p.press("#md-name-in", "Enter"); await p.waitForTimeout(150);
  check("an unnamed menu asks which bar it is, and saves the answer", /Anvil Bar & Refuge/.test(await p.text(".md-bar")) && (await p.evaluate("__MOCK.tables.menus.find(x => x.id === 903).bar")) === "Anvil Bar & Refuge");
  check("no errors", p.errors.length === 0, p.errors.join("; "));
  await p.close();
}
