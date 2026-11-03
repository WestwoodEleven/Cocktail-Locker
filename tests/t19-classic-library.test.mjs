import { open, check, sample } from "./harness.mjs";
import { CLASSICS } from "../tools/classics-data.mjs";
export default async function () {
  // Every spec we load is recognized as its own classic.
  const p0 = await open({});
  const specs = CLASSICS.map(c => ({ name: c[0], ingredients: c[6].map(([amount, unit, name]) => ({ amount, unit, name })) }));
  const got = await p0.evaluate(s => s.map(d => [d.name, detectClassic(d)]), specs);
  const wrong = got.filter(([n, c]) => n !== c);
  check("every loaded classic spec is recognized as itself", !wrong.length, JSON.stringify(wrong));
  check("every loaded classic has a recognition rule", specs.every(s => true) && (await p0.evaluate(n => n.filter(x => !CLASSIC_NAMES.includes(x)), specs.map(s => s.name))).length === 0);
  await p0.close();

  // A house riff on the Daiquiri, and an admin.
  const t = sample();
  t.drinks.push({ id: "hd", owner: "u2", name: "House Daiquiri", data: { name: "House Daiquiri", method: "Shaken", glass: "Coupe", ingredients: [{ amount: 2, unit: "oz", name: "Aged rum" }, { amount: 1, unit: "oz", name: "Lime juice" }, { amount: 0.75, unit: "oz", name: "Demerara syrup" }] }, updated_at: new Date().toISOString() });
  t.drinks.push({ id: "dq", owner: "u2", name: "Daiquiri", data: { name: "Daiquiri", method: "Shaken", glass: "Coupe", ingredients: [{ amount: 2, unit: "oz", name: "White rum" }, { amount: 1, unit: "oz", name: "Lime juice" }, { amount: 0.75, unit: "oz", name: "Simple syrup" }] }, updated_at: new Date().toISOString() });
  t.site_admins = [{ user_id: "u1" }];
  const p = await open({ user: "u1", tables: t });
  const ids = await p.evaluate("[...document.querySelectorAll('#list button[data-id]')].map(b => b.dataset.id)");
  check("classics show in the main list", ids.includes("std:daiquiri"), JSON.stringify(ids));
  check("a house drink with the same name comes first", ids.indexOf("dq") < ids.indexOf("std:daiquiri"));
  check("classics are tagged", /classic/i.test(await p.text("#list button[data-id='std:daiquiri']")));
  await p.click("#fchips [data-fv='std']"); await p.waitForTimeout(150);
  const only = await p.evaluate("[...document.querySelectorAll('#list button[data-id]')].map(b => b.dataset.id)");
  check("the Classics chip shows only classics", only.length > 0 && only.every(x => x.startsWith("std:")), JSON.stringify(only));
  await p.click("#fchips [data-fv='std']"); await p.waitForTimeout(100);
  await p.pick("std:daiquiri"); await p.waitForTimeout(150);
  const main = await p.text("#main");
  check("a classic's page lists its riffs", /riffs on the daiquiri/i.test(main) && /house daiquiri/i.test(main), main.slice(0, 400));
  await p.act("std-edit-btn"); await p.waitForTimeout(150);
  await p.fill("#f-garnish", "Lime wheel, thin"); await p.click("#save-btn"); await p.waitForTimeout(250);
  const row = await p.evaluate("window.__MOCK.tables.standard_recipes.find(r => r.slug === 'daiquiri')");
  check("an admin can correct a classic", row.data.garnish === "Lime wheel, thin" && row.data.about === "Cuban classic.", JSON.stringify(row));
  check("and the page shows it", /lime wheel, thin/i.test(await p.text("#main")));
  check("no errors", p.errors.length === 0, p.errors.join("; "));
  await p.close();

  // Not an admin: no edit button.
  const p2 = await open({ user: "u2" });
  await p2.pick("std:daiquiri"); await p2.waitForTimeout(100);
  check("others can't edit classics", !(await p2.evaluate("!!document.getElementById('std-edit-btn')")));
  await p2.close();
}
