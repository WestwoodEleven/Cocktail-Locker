import { open, check } from "./harness.mjs";
export default async function () {
  const p = await open();
  await p.click("#locker-btn"); await p.waitForTimeout(150);
  check("old plain-name bar still loads", (await p.text("#chips-liquors")).includes("Campari"));
  check("My drinks has one Add button", await p.isVisible("#prof-drink-add") && !(await p.evaluate("!!document.getElementById('prof-scan') || !!document.getElementById('prof-new')")));
  await p.click("#prof-drink-add"); await p.waitForTimeout(50);
  check("Add a drink offers a photo or typing", /from a photo/i.test(await p.text("#gen-body")) && /type it in/i.test(await p.text("#gen-body")));
  await p.click("#da-type"); await p.waitForTimeout(100);
  check("Type it in opens a new drink", await p.isVisible("#f-name") && !(await p.isVisible("#gen-modal")));
  await p.click("#locker-btn"); await p.waitForTimeout(150);
  check("no typing boxes in My bottles", !(await p.evaluate("!!document.querySelector('#prof-bar input[type=text]')")));
  // add a bottle with a brand through + Add, Type it in
  await p.click("#prof-bottle-add"); await p.waitForTimeout(50);
  check("Add offers photos or typing", /from photos/i.test(await p.text("#gen-body")) && /type it in/i.test(await p.text("#gen-body")));
  await p.click("#ba-type"); await p.waitForTimeout(50);
  await p.fill("#ba-name", "Bourbon"); await p.fill("#ba-brand", "Buffalo Trace"); await p.press("#ba-brand", "Enter"); await p.waitForTimeout(900);
  check("form stays open to add another", /added bourbon/i.test(await p.text("#ba-msg")) && (await p.inputValue("#ba-name")) === "");
  check("bottle shows its brand", (await p.text("#chips-liquors")).includes("Bourbon Buffalo Trace"));
  const saved = await p.evaluate("window.__MOCK.tables.bars[0].items.liquors");
  check("brand saved with the bar", saved.some(x => x.name === "Bourbon" && x.brand === "Buffalo Trace"), JSON.stringify(saved));
  // same name, different brand allowed
  await p.fill("#ba-name", "Bourbon"); await p.fill("#ba-brand", "Wild Turkey"); await p.click("#ba-form button[type=submit]"); await p.waitForTimeout(100);
  await p.selectOption("#ba-kind", "bitters"); await p.fill("#ba-name", "Orange bitters"); await p.click("#ba-form button[type=submit]"); await p.waitForTimeout(100);
  check("type picks the shelf", /orange bitters/i.test(await p.text("#chips-bitters")));
  await p.click("#ba-done"); await p.waitForTimeout(50);
  check("two brands of the same spirit can coexist", ((await p.text("#chips-liquors")).match(/Bourbon/g) || []).length === 2);
  // edit an existing item's brand
  await p.click("#chips-liquors [data-edit='1']"); await p.waitForTimeout(50);
  await p.fill("#bi-brand", "Campari Milano"); await p.click("#bi-save"); await p.waitForTimeout(100);
  check("tap a bottle to add a brand", (await p.text("#chips-liquors")).includes("Campari Campari Milano"));
  // mark out of stock
  await p.click("#chips-liquors [data-out='1']"); await p.waitForTimeout(900);
  check("out of stock shown on the chip", (await p.evaluate("document.querySelectorAll('#chips-liquors .bar-chip.out').length")) === 1);
  check("out of stock summary", (await p.text("#bar-out")).includes("Out of stock: Campari (Campari Milano)"));
  check("out-of-stock item not counted as a bottle", (await p.text(".stats")).includes("9 | Bottles"), await p.text(".stats"));
  const saved2 = await p.evaluate("window.__MOCK.tables.bars[0].items.liquors.find(x => x.name === 'Campari')");
  check("out of stock saved", saved2.out === true);
  // effect on What can I make?
  await p.click("#canmake-btn"); await p.waitForTimeout(150);
  const t = await p.text("#main");
  check("Negronis drop out of Ready when Campari is out", /Ready to make\s*\|?\s*0/.test(t) && t.includes("Out of Campari"), t.slice(0, 500));
  // brand match: recipe calls for Cointreau by brand
  await p.click("#chips-liquors [data-out='1']"); await p.waitForTimeout(400);
  check("restocking brings them back", /Ready to make\s*\|?\s*2/.test(await p.text("#main")));
  // AI tools get in-stock items with brands only
  await p.click("#chips-liquors [data-out='1']"); await p.waitForTimeout(400);
  await p.evaluate("window.__MOCK.invoke = async () => ({ data: { drinks: [] }, error: null })");
  await p.evaluate("openMake()"); await p.waitForTimeout(100); await p.click("#make-go"); await p.waitForTimeout(150);
  const sent = await p.evaluate("window.__MOCK.lastInvoke.bar.liquors");
  check("AI gets brands and skips out-of-stock bottles", sent.includes("Bourbon (Buffalo Trace)") && !sent.some(x => x.startsWith("Campari")), JSON.stringify(sent));
  await p.setViewportSize({ width: 390, height: 844 });
  await p.click("#acct-btn"); await p.click("#acct-cart"); await p.waitForTimeout(100);
  check("no sideways scroll on phone", (await p.evaluate("document.documentElement.scrollWidth")) <= 390);
  check("no errors", p.errors.length === 0, p.errors.join("; "));
  await p.close();
}
