import { open, check, sample } from "./harness.mjs";
const rows = p => p.evaluate("(window.__MOCK.tables.shopping_list || []).filter(r => r.user_id === 'u1')");
export default async function () {
  const t = sample();
  t.bars[0].items.liquors.push({ name: "Bourbon", brand: "Buffalo Trace", out: true });
  const p = await open({ user: "u1", tables: t });
  // What can I make?: pick-ups and missing bottles get + List
  await p.evaluate("openCanMake()"); await p.waitForTimeout(200);
  check("What can I make? offers + List for pick-ups and missing bottles", await p.isVisible("li.has-shop [data-shop-add='Ginger beer']") && await p.isVisible(".worth [data-shop-add='Orange liqueur']"));
  await p.click("li.has-shop [data-shop-add='Ginger beer']"); await p.waitForTimeout(200);
  let r = await rows(p);
  check("adds it with a reason, as a mixer", r.length === 1 && r[0].name === "Ginger beer" && r[0].kind === "mixer" && r[0].reason === "For the Moscow Mule", JSON.stringify(r));
  check("the button turns into On list", /on list/i.test(await p.text("li.has-shop [data-shop-add='Ginger beer']")));
  await p.click(".worth [data-shop-add='Orange liqueur']"); await p.waitForTimeout(200);
  r = await rows(p);
  check("bottles go under Bottles", r.find(x => x.name === "Orange liqueur").kind === "bottle");
  // a recipe: only what you don't have
  await p.pick("rita"); await p.waitForTimeout(150);
  await p.click("#shop-recipe"); await p.waitForTimeout(300);
  r = await rows(p);
  check("recipe adds only what you're missing, and nothing twice", r.length === 2, JSON.stringify(r.map(x => x.name)));
  // bottle edit sheet
  await p.evaluate("navGo('cart')"); await p.waitForTimeout(200);
  await p.evaluate("editItem('liquors', S.bar.liquors.findIndex(x => (x.name || x) === 'Campari'))"); await p.waitForTimeout(100);
  await p.click(".bi-shop [data-shop-add]"); await p.waitForTimeout(200);
  r = await rows(p);
  check("Running low? adds a bottle from My Bottles", r.some(x => x.name === "Campari" && x.reason === "Running low"), JSON.stringify(r.map(x => x.name)));
  await p.evaluate("closeSheet()");
  // the page
  await p.evaluate("openShop()"); await p.waitForTimeout(200);
  const page = await p.text("#main");
  check("list groups bottles and mixers and suggests out-of-stock bottles", /bottles/i.test(page) && /juices, mixers/i.test(page) && /suggested/i.test(page) && page.includes("Bourbon (Buffalo Trace)"), page);
  await p.fill("#shop-in", "Maraschino cherries"); await p.press("#shop-in", "Enter"); await p.waitForTimeout(200);
  check("add anything by typing", (await rows(p)).some(x => x.name === "Maraschino cherries"));
  // check off a bottle you have out of stock -> back in stock
  await p.click(".shop-sugg [data-shop-add]"); await p.waitForTimeout(200);
  const bourbon = (await rows(p)).find(x => /bourbon/i.test(x.name));
  await p.click(`label:has([data-shop-done='${bourbon.id}'])`); await p.waitForTimeout(200);
  check("checking off a bottle asks to restock it", /mark it back in stock/i.test(await p.text(".shop-prompt")));
  await p.click("#shop-stock"); await p.waitForTimeout(500);
  check("…and puts it back in stock", (await p.evaluate("S.bar.liquors.find(x => x.name === 'Bourbon').out")) === false && (await rows(p)).find(x => x.id === bourbon.id).done === true);
  // check off a new bottle -> add to My Bottles
  const ol = (await rows(p)).find(x => x.name === "Orange liqueur");
  await p.click(`label:has([data-shop-done='${ol.id}'])`); await p.waitForTimeout(200);
  check("a bottle you don't have offers Add to My Bottles", /add it to my bottles/i.test(await p.text(".shop-prompt")));
  await p.click("#shop-stock"); await p.waitForTimeout(500);
  check("…and adds it", await p.evaluate("S.bar.liquors.some(x => x.name === 'Orange liqueur')"));
  await p.click("#shop-clear"); await p.waitForTimeout(200);
  check("Clear removes checked items", (await rows(p)).every(x => !x.done) && (await rows(p)).length === 3, JSON.stringify((await rows(p)).map(x => x.name)));
  await p.evaluate("navigator.clipboard.writeText = async t => { window.__copied = t; }; navigator.share = undefined");
  await p.click("#shop-share"); await p.waitForTimeout(100);
  check("Share sends a plain-text list", /^My Cocktail Cart shopping list:\n☐ /.test(await p.evaluate("window.__copied || ''")));
  await p.click("#acct-btn").catch(() => {}); await p.evaluate("openAccountMenu()"); await p.waitForTimeout(100);
  check("the menu shows Shopping list with a count", /shopping list \(3\)/i.test(await p.text("#gen-modal")));
  await p.evaluate("closeSheet()");
  // party planner
  await p.evaluate("S.party.items = [{ id: 'neg-1', share: 1 }]; S.party.guests = 10; openParty()"); await p.waitForTimeout(200);
  if (await p.isVisible("#pp-shop")) { await p.click("#pp-shop"); await p.waitForTimeout(500); }
  check("party planner adds its list", (await rows(p)).some(x => /^Party:/.test(x.reason || "")), JSON.stringify((await rows(p)).map(x => x.reason)));
  check("no errors", p.errors.length === 0, p.errors.join("; "));
  await p.close();
}
