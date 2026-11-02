import { open, check, sample } from "./harness.mjs";
import { fileURLToPath } from "node:url";
const fx = n => fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url));
const invoke = `async (name, body) => {
  await new Promise(r => setTimeout(r, 150));
  if (body.mode !== "bottle") return { data: null, error: { name: "FunctionsFetchError" } };
  if (/^gin$/i.test(body.query)) return { data: null, error: { name: "FunctionsHttpError", context: new Response(JSON.stringify({ error: "not_a_bottle", did_you_mean: "Tanqueray London Dry" }), { status: 422 }) } };
  return { data: { bottle: { slug: "buffalo-trace", name: "Buffalo Trace", product: "Buffalo Trace Kentucky Straight Bourbon", ingredient: "Bourbon", category: "whiskey", producer: "Buffalo Trace Distillery", origin: "Kentucky, USA", abv: 45, age: "", description: "Sweet vanilla and caramel.", aliases: ["buffalo-trace-bourbon"] } }, error: null };
}`;
export default async function () {
  const p = await open({ invoke });
  check("Bottle guide in Tools", await p.isVisible("#guide-btn"));
  // recipe brand links to bottle page
  await p.click("#list button[data-id='rita']");
  await p.click(".brand-link[data-bottle='Cointreau']"); await p.waitForTimeout(100);
  let t = await p.text("#main");
  check("recipe brand opens the bottle page", t.includes("Cointreau Triple Sec") && t.includes("40% ABV") && (await p.evaluate("location.hash")) === "#bottle-cointreau", t.slice(0, 300));
  check("shows others' comments", t.includes("Essential for Margaritas."));
  check("lists recipes that call for it", /Recipes that call for it\s*\|?\s*1/.test(t) && t.includes("Mitch-A-Rita"));
  check("AI note and fix link shown", t.includes("Written by AI and may contain errors") && await p.isVisible("#bt-fix"));
  check("non-admins can't edit details", !(await p.isVisible("#bt-edit")));
  // rate + comment
  await p.click("[data-bstar='4']"); await p.waitForTimeout(100);
  await p.fill("#bt-comment", "Great in a Sidecar."); await p.click("#bt-comment-save"); await p.waitForTimeout(100);
  const rev = await p.evaluate("window.__MOCK.tables.bottle_reviews.find(r => r.user_id === 'u1')");
  check("rating and comment saved", rev && rev.stars === 4 && rev.comment === "Great in a Sidecar.", JSON.stringify(rev));
  check("average updates", (await p.text("#main")).includes("4.5 · 2 ratings"));
  // suggest a fix
  await p.click("#bt-fix"); await p.fill("#fix-msg", "It's made in Saint-Barthélemy-d'Anjou."); await p.click("#fix-send"); await p.waitForTimeout(100);
  check("fix suggestion sent", (await p.evaluate("window.__MOCK.tables.bottle_reports.length")) === 1);
  // add to bar
  await p.click("#bt-addbar"); await p.waitForTimeout(900);
  check("add to bar uses type + brand", (await p.evaluate("window.__MOCK.tables.bars[0].items.liquors.some(x => x.name === 'Orange liqueur' && x.brand === 'Cointreau')")) && (await p.text("#main")).includes("In your bar ✓"));
  // photo
  await p.setInputFiles("#bottle-file", fx("shelf1.jpg")); await p.waitForTimeout(600);
  check("photo added to the page", (await p.evaluate("window.__MOCK.tables.bottle_photos.length")) === 1 && await p.isVisible(".bottle-photo img"));
  // look up a new bottle from the guide
  await p.click("#guide-btn"); await p.waitForTimeout(100);
  const g = await p.text("#main");
  check("guide lists known bottles with ABV", g.includes("Cointreau") && g.includes("Orange liqueur · 40% ABV"), g);
  check("non-alcoholic shown as 0.0% NA", g.includes("Orgeat · 0.0% NA") && g.includes("Non-alcoholic spirit · 0.0% NA"));
  await p.fill("#gd-search", "Buffalo Trace Bourbon"); await p.click("#gd-go"); await p.waitForTimeout(60);
  check("new bottle shows looking-up state", (await p.text("#main")).includes("Looking up"));
  await p.waitForTimeout(300);
  t = await p.text("#main");
  check("new bottle page created", t.includes("Buffalo Trace Kentucky Straight Bourbon") && (await p.evaluate("location.hash")) === "#bottle-buffalo-trace");
  await p.click("#bt-back"); await p.waitForTimeout(100);
  check("Back returns to the guide", (await p.text("#main")).includes("Bottles") && (await p.text("#main")).includes("Buffalo Trace"));
  // not a bottle
  await p.fill("#gd-search", "gin"); await p.click("#gd-go"); await p.waitForTimeout(350);
  t = await p.text("#main");
  check("generic spirit suggests a product", t.includes("That isn't a specific bottle") && t.includes("Look up Tanqueray London Dry"));
  // search shows bottles
  await p.fill("#search", "cointreau"); await p.waitForTimeout(100);
  check("main search lists matching bottles", (await p.text("#list")).includes("BOTTLES") && (await p.evaluate("!!document.querySelector('#list [data-bottle=Cointreau]')")));
  // bar chip edit sheet links to bottle page
  await p.click("#locker-btn"); await p.waitForTimeout(100);
  await p.click("#chips-liquors [data-edit]:has-text('Cointreau')"); await p.waitForTimeout(50);
  check("bar bottle links to its page", await p.isVisible("#gen-body [data-bottle='Cointreau']"));
  await p.click("#gen-body [data-bottle='Cointreau']"); await p.waitForTimeout(100);
  check("opens from the bar", (await p.evaluate("location.hash")) === "#bottle-cointreau");
  await p.setViewportSize({ width: 390, height: 844 });
  check("no sideways scroll on phone", (await p.evaluate("document.documentElement.scrollWidth")) <= 390);
  check("no errors", p.errors.length === 0, p.errors.join("; "));
  await p.close();
  // admin can edit
  const tables = sample(); tables.site_admins = [{ user_id: "u1" }]; tables.bottle_reports = [{ id: 1, slug: "cointreau", message: "ABV is 40%" }];
  const a = await open({ tables, hash: "#bottle-cointreau" }); await a.waitForTimeout(300);
  check("admin sees Edit details", await a.isVisible("#bt-edit"));
  await a.click("#bt-edit"); await a.waitForTimeout(100);
  check("admin sees suggested fixes", (await a.text("#gen-body")).includes("ABV is 40%"));
  await a.fill("#eb-desc", "Updated description."); await a.click("#eb-clear"); await a.waitForTimeout(150);
  check("admin edit saved and fixes cleared", (await a.evaluate("window.__MOCK.tables.bottles[0].description")) === "Updated description." && (await a.evaluate("window.__MOCK.tables.bottle_reports.length")) === 0);
  check("no errors (admin)", a.errors.length === 0, a.errors.join("; "));
  await a.close();
}
