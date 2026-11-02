// Test helpers: open the site in headless Chromium with the Supabase stand-in.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mockJs = readFileSync(path.join(root, "tests/mock-supabase.js"), "utf8");
let browser;
export async function start() { browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}); }
export async function stop() { if (browser) await browser.close(); }

const ing = (...names) => names.map(n => typeof n === "string" ? { amount: 1, unit: "oz", name: n } : n);
export const sample = () => ({
  drinks: [
    { id: "rita", owner: "u1", name: "Mitch-A-Rita", data: { name: "Mitch-A-Rita", method: "Shaken", glass: "Rocks", garnish: "Lime wheel", notes: "Shake hard with ice. Strain over fresh ice.",
      ingredients: ing({ amount: 1.5, unit: "oz", name: "Tequila blanco", brand: "Corralejo" }, { amount: 1, unit: "oz", name: "Fresh lime juice" }, { amount: 0.5, unit: "oz", name: "Simple syrup" }, { amount: 0.5, unit: "oz", name: "Orange liqueur", brand: "Cointreau" }), updatedAt: "2026-10-30" } },
    { id: "neg-1", owner: "u2", name: "Negroni", data: { name: "Negroni", method: "Stirred", glass: "Rocks", garnish: "Orange peel", ingredients: ing("Gin", "Campari", "Sweet vermouth"), updatedAt: "2026-10-01" } },
    { id: "neg-2", owner: "u1", name: "Negroni", data: { name: "Negroni", method: "Stirred", glass: "Rocks", ingredients: ing("London dry gin", "Campari", "Carpano Antica"), updatedAt: "2026-10-20" } },
    { id: "pk", owner: "u2", name: "Painkiller", data: { name: "Painkiller", method: "Shaken", ingredients: ing({ amount: 2, unit: "oz", name: "Gold rum" }, { amount: 3, unit: "oz", name: "Pineapple juice" }, { amount: 1, unit: "oz", name: "Cream of coconut" }, { amount: 1, unit: "oz", name: "Orange juice" }, { amount: 0.5, unit: "oz", name: "Dark rum", float: true }), updatedAt: "2026-10-25" } },
    { id: "mule", owner: "u3", name: "Moscow Mule", data: { name: "Moscow Mule", method: "Built", glass: "Copper mug", ingredients: ing({ amount: 2, unit: "oz", name: "Vodka" }, { amount: 0.5, unit: "oz", name: "Lime juice" }, { amount: 4, unit: "oz", name: "Ginger beer" }), updatedAt: "2026-09-01" } }
  ],
  profiles: [{ id: "u1", display_name: "Mitch's Bar" }, { id: "u2", display_name: "Sam's Shelf" }, { id: "u3", display_name: "Jo's Cart" }],
  ratings: [{ drink_id: "neg-1", user_id: "u2", stars: 5, note: "Perfect bitter balance." }, { drink_id: "neg-1", user_id: "u3", stars: 4 }, { drink_id: "neg-2", user_id: "u3", stars: 3, note: "A bit sweet." }],
  favorites: [{ user_id: "u1", drink_id: "neg-1" }],
  bars: [{ user_id: "u1", items: { liquors: ["Gin", "Campari", "Sweet vermouth", "Vodka", "Tequila"], syrups: ["Simple syrup"], bitters: ["Angostura bitters"] } }],
  standard_recipes: [{ slug: "daiquiri", name: "Daiquiri", aliases: [], data: { name: "Daiquiri", method: "Shaken", type: "Sour", base: "Rum", glass: "Coupe",
    ingredients: [{ amount: 2, unit: "oz", name: "White rum" }, { amount: 1, unit: "oz", name: "Lime juice" }, { amount: 0.75, unit: "oz", name: "Simple syrup" }], about: "Cuban classic." } }],
  collections: [], collection_items: [], follows: [],
  bottles: [{ slug: "cointreau", name: "Cointreau", product: "Cointreau Triple Sec", ingredient: "Orange liqueur", category: "liqueur", producer: "Rémy Cointreau", origin: "Angers, France", abv: 40, age: "", description: "A clear orange liqueur.", aliases: [] },
    { slug: "orgeat", name: "Small Hand Orgeat", product: "Small Hand Foods Orgeat", ingredient: "Orgeat", category: "syrup", abv: null, description: "Almond syrup.", aliases: [] },
    { slug: "seedlip", name: "Seedlip Garden 108", product: "Seedlip Garden 108", ingredient: "Non-alcoholic spirit", category: "other", abv: 0, description: "Zero-proof.", aliases: [] }],
  bottle_photos: [], bottle_reviews: [{ slug: "cointreau", user_id: "u2", stars: 5, comment: "Essential for Margaritas." }], bottle_reports: [], site_admins: []
});

export async function open({ user = "u1", tables = sample(), invoke = null, width = 1200, hash = "", adult = true } = {}) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.route("**/*", r => {
    const u = r.request().url();
    if (/config\.js(\?|$)/.test(u)) return r.fulfill({ body: "window.MC_CONFIG={supabaseUrl:'https://x.supabase.co',supabaseAnonKey:'k'};", contentType: "text/javascript" });
    if (/^https?:/.test(u)) return r.abort();
    return r.continue();
  });
  // drinks rows use {id, owner, data}; flatten the name helper used above
  const t = JSON.parse(JSON.stringify(tables));
  t.drinks = t.drinks.map(d => ({ id: d.id, owner: d.owner, data: d.data }));
  await page.addInitScript(`window.__MOCK = { user: ${JSON.stringify(user)}, tables: ${JSON.stringify(t)} };`);
  if (invoke) await page.addInitScript(`window.__MOCK.invoke = ${invoke};`);
  if (adult) await page.addInitScript(`try { localStorage.setItem("mc-age", "21"); } catch (e) {}`);
  await page.addInitScript(mockJs);
  await page.goto(pathToFileURL(path.join(root, "index.html")).href + hash);
  await page.waitForTimeout(500);
  page.errors = errors;
  page.text = async sel => (await page.innerText(sel)).replace(/\s*[\n\t]\s*/g, " | ");
  return page;
}

let failures = 0, passes = 0;
export function check(name, cond, info = "") {
  if (cond) { passes++; console.log("  ok   " + name); } else { failures++; console.log("  FAIL " + name + (info ? "  -> " + info : "")); }
}
export function summary() { console.log(`\n${passes} passed, ${failures} failed`); return failures; }
